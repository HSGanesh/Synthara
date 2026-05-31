from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from app.rag.embedder import get_embedder
from app.config import settings

def get_vectorstore(collection_name: str = "synthara_default"):
    embedder = get_embedder()
    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=embedder,
        persist_directory=settings.CHROMA_DB_PATH
    )
    return vectorstore

def add_documents(documents: list[Document], collection_name: str = "synthara_default"):
    vectorstore = get_vectorstore(collection_name)
    vectorstore.add_documents(documents)
    print(f"✅ {len(documents)} chunks added to collection: {collection_name}")
    return vectorstore

def list_collections():
    import chromadb
    client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
    return [col.name for col in client.list_collections()]