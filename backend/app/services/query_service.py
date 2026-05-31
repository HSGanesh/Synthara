from app.rag.pipeline import get_rag_pipeline
from app.rag.retriever import get_retriever

def process_query(question: str, collection_name: str = "synthara_default") -> dict:
    chain = get_rag_pipeline(collection_name=collection_name)
    answer = chain.invoke(question)

    retriever = get_retriever(collection_name=collection_name, k=4)
    docs = retriever.invoke(question)
    sources = list(set(
        doc.metadata.get("source", "Unknown") for doc in docs
    ))

    return {"answer": answer, "sources": sources, "collection": collection_name}