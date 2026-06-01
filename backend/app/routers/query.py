from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.query import QueryRequest, QueryResponse
from app.services.query_service import process_query
from app.database import get_db
from app.config import settings
import jwt
from pydantic import BaseModel
from app.rag.vectorstore import get_vectorstore

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

class RepoOverviewRequest(BaseModel):
    collection_name: str
    token: str = None


@router.post("/repo-overview")
def get_repo_overview(
    request: RepoOverviewRequest,
    db: Session = Depends(get_db)
):
    from langchain_groq import ChatGroq

    vectorstore = get_vectorstore(request.collection_name)

    try:
        raw = vectorstore.similarity_search(
            "project overview README purpose structure", k=20
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector search failed: {e}")

    if not raw:
        raise HTTPException(
            status_code=404,
            detail="No documents found in this collection. Ingest a repository first."
        )

    seen_sources = set()
    context_parts = []
    for doc in raw:
        src = doc.metadata.get("source", "unknown")
        if src not in seen_sources:
            seen_sources.add(src)
            context_parts.append(f"--- FILE: {src} ---\n{doc.page_content[:800]}")

    context = "\n\n".join(context_parts[:15])

    OVERVIEW_PROMPT = f"""
You are Synthara, an expert developer assistant analysing a software repository.

Based on the file contents below, generate a comprehensive repository overview in the following exact markdown structure. Output only the structured overview — no preamble, no closing remarks.

## 🏷️ Project Name
(Name of the project)

## 🎯 Purpose
(1–3 sentences describing what this project does and who it's for)

## 🛠️ Tech Stack
(Bullet list: languages, frameworks, libraries, databases, tools)

## 📁 Folder Structure
(Key directories and what they contain — 6–10 entries)

## 🚀 Main Entry Points
(Files where execution starts, with brief descriptions)

## ✨ Key Features
(Bullet list of 5–8 notable features or capabilities)

## 🔗 Architecture Summary
(2–4 sentences describing how the system is structured at a high level)

---

Repository files:
{context}
"""

    try:
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            api_key=settings.GROQ_API_KEY,
            temperature=0.1
        )
        response = llm.invoke(OVERVIEW_PROMPT)
        overview_text = response.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {e}")

    user_id = get_current_user_id(token=request.token, db=db)
    if user_id:
        from app.models.db_models import ChatHistory
        import json
        chat = ChatHistory(
            user_id=user_id,
            collection=request.collection_name,
            question="Explain this repository",
            answer=overview_text,
            sources=json.dumps(list(seen_sources)[:5])
        )
        db.add(chat)
        db.commit()

    return {
        "overview": overview_text,
        "files_analysed": len(seen_sources),
        "collection": request.collection_name
    }