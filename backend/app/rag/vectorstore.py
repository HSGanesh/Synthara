# backend/app/rag/vectorstore.py
from langchain_qdrant import QdrantVectorStore
from langchain_core.documents import Document
from app.rag.embedder import get_embedder
from app.config import settings

def get_vectorstore(collection_name: str = "synthara_default") -> QdrantVectorStore:
    embedder = get_embedder()
    vectorstore = QdrantVectorStore.from_existing_collection(
        embedding=embedder,
        collection_name=collection_name,
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY,
    )
    return vectorstore

def add_documents(documents: list[Document], collection_name: str = "synthara_default"):
    embedder = get_embedder()
    QdrantVectorStore.from_documents(
        documents=documents,
        embedding=embedder,
        collection_name=collection_name,
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY,
    )
    print(f"✅ {len(documents)} chunks added to collection: {collection_name}")


def list_collections() -> list[str]:
    from qdrant_client import QdrantClient
    client = QdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY or None,
    )
    collections = client.get_collections().collections
    return [col.name for col in collections]