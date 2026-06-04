from app.rag.pipeline import get_rag_pipeline
from app.models.db_models import Conversation, Message, User
from sqlalchemy.orm import Session
from datetime import datetime
import json


def generate_title(question: str) -> str:
    """
    Generate a short, meaningful conversation title from the first user message.
    We do this locally (no extra LLM call) using heuristics; clean and truncate.
    """
    # Strip common filler phrases
    title = question.strip()
    fillers = [
        "can you ", "could you ", "please ", "i want to know ",
        "tell me ", "explain ", "what is ", "how does ", "how do ",
        "what are ", "show me ", "help me ",
    ]
    lower = title.lower()
    for f in fillers:
        if lower.startswith(f):
            title = title[len(f):]
            break

    # Capitalise first letter, trim to 60 chars
    title = title.strip().capitalize()
    if len(title) > 60:
        title = title[:57].rstrip() + "..."
    return title or "New conversation"


def get_or_create_conversation(
    db: Session,
    user_id: int,
    session_id: str,
    collection_name: str,
    first_question: str,
) -> Conversation:
    conv = db.query(Conversation).filter(
        Conversation.session_id == session_id,
        Conversation.user_id == user_id,
    ).first()

    if not conv:
        title = generate_title(first_question)
        conv = Conversation(
            session_id=session_id,
            user_id=user_id,
            collection=collection_name,
            title=title,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(conv)
        db.flush()   # get the id without committing

    else:
        # Update collection and timestamp on every new message
        conv.collection = collection_name
        conv.updated_at = datetime.utcnow()

    return conv


def process_query(
    question: str,
    collection_name: str = "synthara_default",
    db: Session = None,
    user_id: int = None,
    history: list = None,
    session_id: str = None,
) -> dict:
    pipeline = get_rag_pipeline(collection_name=collection_name)

    # Normalise history: ConversationTurn Pydantic objects -> plain dicts
    # pipeline.py uses turn.get("role") / turn.get("content") so must be dicts
    def _to_dict(turn):
        if isinstance(turn, dict):
            return turn
        return {"role": getattr(turn, "role", "user"), "content": getattr(turn, "content", "")}

    history_dicts = [_to_dict(t) for t in (history or [])]
    result = pipeline(question, history=history_dicts)
    answer = result["answer"]
    docs = result["docs"]
    sources = list(set(doc.metadata.get("source", "Unknown") for doc in docs))

    conversation_title = None

    if db and user_id and session_id:
        # Update last_active_collection on the user
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.last_active_collection = collection_name

        # Get or create the conversation row
        conv = get_or_create_conversation(
            db=db,
            user_id=user_id,
            session_id=session_id,
            collection_name=collection_name,
            first_question=question,
        )
        conversation_title = conv.title

        # Append the message
        msg = Message(
            conversation_id=conv.id,
            question=question,
            answer=answer,
            sources=json.dumps(sources),
            created_at=datetime.utcnow(),
        )
        db.add(msg)
        db.commit()

    return {
        "answer": answer,
        "sources": sources,
        "collection": collection_name,
        "session_id": session_id,
        "conversation_title": conversation_title,
    }