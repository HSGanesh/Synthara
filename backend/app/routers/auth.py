from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services.auth_service import register_user, authenticate_user, create_access_token, get_user_by_username
from app.database import get_db
import jwt
from app.config import settings

router = APIRouter()

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
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        user = get_user_by_username(db, username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": user.id, "username": user.username, "created_at": user.created_at}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/history")
def get_chat_history(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        user = get_user_by_username(db, username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        from app.models.db_models import ChatHistory
        import json

        history = db.query(ChatHistory).filter(
            ChatHistory.user_id == user.id
        ).order_by(ChatHistory.created_at.asc()).limit(200).all()

        # Group by session_id — each session = one conversation
        sessions = {}
        for h in history:
            sid = h.session_id or str(h.id)  # fallback for old records
            if sid not in sessions:
                sessions[sid] = {
                    "session_id": sid,
                    "title": h.question[:60],  # first question = conversation title
                    "collection": h.collection.replace(f"{username}__", ""),
                    "created_at": str(h.created_at),
                    "messages": []
                }
            sessions[sid]["messages"].append({
                "id": h.id,
                "question": h.question,
                "answer": h.answer,
                "sources": json.loads(h.sources),
                "created_at": str(h.created_at)
            })

        # Return newest sessions first
        sorted_sessions = sorted(
            sessions.values(),
            key=lambda s: s["created_at"],
            reverse=True
        )

        return {"history": sorted_sessions}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.delete("/history/{chat_id}")
def delete_chat(chat_id: int, token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        user = get_user_by_username(db, username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        from app.models.db_models import ChatHistory
        chat = db.query(ChatHistory).filter(
            ChatHistory.id == chat_id,
            ChatHistory.user_id == user.id
        ).first()

        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        db.delete(chat)
        db.commit()
        return {"message": "Chat deleted"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.delete("/history/session/{session_id}")
def delete_session(session_id: str, token: str, db: Session = Depends(get_db)):
    """Delete all messages in a session."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        user = get_user_by_username(db, username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        from app.models.db_models import ChatHistory
        db.query(ChatHistory).filter(
            ChatHistory.session_id == session_id,
            ChatHistory.user_id == user.id
        ).delete()
        db.commit()
        return {"message": "Session deleted"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")