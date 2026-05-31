from fastapi import APIRouter, HTTPException
from app.models.query import QueryRequest, QueryResponse
from app.services.query_service import process_query

router = APIRouter()

@router.post("/ask", response_model=QueryResponse)
def ask_question(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    result = process_query(request.question, collection_name=request.collection_name)
    return QueryResponse(
        answer=result["answer"],
        sources=result["sources"],
        collection=result["collection"]
    )