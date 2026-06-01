from app.rag.pipeline import get_rag_pipeline
from app.rag.retriever import get_retriever
from app.models.db_models import ChatHistory
from sqlalchemy.orm import Session
import json

def process_query(
    question: str,
    collection_name: str = "synthara_default",
    db: Session = None,
    user_id: int = None
) -> dict:

    # RAG pipeline
    chain = get_rag_pipeline(collection_name=collection_name)
    answer = chain.invoke(question)

    # Get sources
    retriever = get_retriever(collection_name=collection_name, k=4)
    docs = retriever.invoke(question)
    sources = list(set(
        doc.metadata.get("source", "Unknown") for doc in docs
    ))

    # Save to chat history if db and user provided
    if db and user_id:
        chat = ChatHistory(
            user_id=user_id,
            collection=collection_name,
            question=question,
            answer=answer,
            sources=json.dumps(sources)
        )
        db.add(chat)
        db.commit()

    return {"answer": answer, "sources": sources, "collection": collection_name}