from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.query import QueryRequest, QueryResponse
from app.services.query_service import process_query
from app.database import get_db
from app.config import settings
import jwt

router = APIRouter()

def get_current_user_id(token: str = None, db: Session = None) -> int | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        from app.models.db_models import User
        user = db.query(User).filter(User.username == username).first()
        return user.id if user else None
    except Exception:
        return None

@router.post("/ask", response_model=QueryResponse)
def ask_question(
    request: QueryRequest,
    db: Session = Depends(get_db)
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Extract token from request if provided
    user_id = get_current_user_id(
        token=getattr(request, 'token', None),
        db=db
    )

    result = process_query(
        question=request.question,
        collection_name=request.collection_name,
        db=db,
        user_id=user_id
    )

    return QueryResponse(
        answer=result["answer"],
        sources=result["sources"],
        collection=result["collection"]
    )