from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services.auth_service import (
    register_user, authenticate_user, create_access_token, get_user_by_username
)
from app.database import get_db
import jwt, json
from app.config import settings
from app.models.db_models import Conversation, Message, User
from datetime import datetime

router = APIRouter()


# ─── helpers ───────────────────────────────────────────────────────────────

def decode_user(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        user = get_user_by_username(db, username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def conversation_to_dict(conv: Conversation, username: str) -> dict:
    """Serialise a Conversation + its Messages for the API response."""
    return {
        "session_id": conv.session_id,
        "title": conv.title or (conv.messages[0].question[:60] if conv.messages else "New conversation"),
        "collection": conv.collection.replace(f"{username}__", ""),
        "collection_raw": conv.collection,
        "created_at": str(conv.created_at),
        "updated_at": str(conv.updated_at),
        "messages": [
            {
                "id": m.id,
                "question": m.question,
                "answer": m.answer,
                "sources": json.loads(m.sources) if isinstance(m.sources, str) else m.sources,
                "created_at": str(m.created_at),
            }
            for m in conv.messages
        ],
    }


# ─── auth ──────────────────────────────────────────────────────────────────

@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    success = register_user(db, request.username, request.password)
    if not success:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": f"User '{request.username}' registered successfully"}


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.username})
    return TokenResponse(access_token=token)


@router.get("/me")
def get_me(token: str, db: Session = Depends(get_db)):
    user = decode_user(token, db)
    return {
        "id": user.id,
        "username": user.username,
        "created_at": user.created_at,
        "last_active_collection": user.last_active_collection,
    }


# ─── conversation list ──────────────────────────────────────────────────────

@router.get("/history")
def get_chat_history(token: str, db: Session = Depends(get_db)):
    """
    Returns all conversations for the user, newest first.
    Each conversation includes all its messages.
    """
    user = decode_user(token, db)

    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(300)
        .all()
    )

    result = [conversation_to_dict(c, user.username) for c in convs]
    return {"history": result, "last_active_collection": user.last_active_collection}


# ─── single conversation ────────────────────────────────────────────────────

@router.get("/conversation/{session_id}")
def get_conversation(session_id: str, token: str, db: Session = Depends(get_db)):
    """Load a single conversation with all its messages."""
    user = decode_user(token, db)
    conv = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_to_dict(conv, user.username)


# ─── delete conversation ────────────────────────────────────────────────────

@router.delete("/conversation/{session_id}")
def delete_conversation(session_id: str, token: str, db: Session = Depends(get_db)):
    user = decode_user(token, db)
    conv = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}


# ─── update last active collection ─────────────────────────────────────────

@router.post("/last-collection")
def update_last_collection(
    data: dict,
    db: Session = Depends(get_db)
):
    """Update the user's last active collection."""
    token = data.get("token")
    collection = data.get("collection")
    if not token or not collection:
        raise HTTPException(status_code=400, detail="token and collection required")
    user = decode_user(token, db)
    user.last_active_collection = collection
    db.commit()
    return {"ok": True}


# ─── rename conversation ────────────────────────────────────────────────────

@router.patch("/conversation/{session_id}/title")
def rename_conversation(session_id: str, data: dict, db: Session = Depends(get_db)):
    token = data.get("token")
    title = data.get("title", "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token required")
    user = decode_user(token, db)
    conv = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.title = title
    db.commit()
    return {"ok": True, "title": title}


# ─── legacy endpoints (kept for backward compat) ───────────────────────────

@router.delete("/history/{chat_id}")
def delete_chat_legacy(chat_id: int, token: str, db: Session = Depends(get_db)):
    from app.models.db_models import ChatHistory
    user = decode_user(token, db)
    chat = db.query(ChatHistory).filter(
        ChatHistory.id == chat_id, ChatHistory.user_id == user.id
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted"}


@router.delete("/history/session/{session_id}")
def delete_session_legacy(session_id: str, token: str, db: Session = Depends(get_db)):
    user = decode_user(token, db)
    # Try new table first
    conv = db.query(Conversation).filter(
        Conversation.session_id == session_id, Conversation.user_id == user.id
    ).first()
    if conv:
        db.delete(conv)
        db.commit()
        return {"message": "Session deleted"}
    # Fall back to legacy table
    from app.models.db_models import ChatHistory
    db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id, ChatHistory.user_id == user.id
    ).delete()
    db.commit()
    return {"message": "Session deleted"}
