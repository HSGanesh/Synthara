from app.rag.vectorstore import get_vectorstore

def get_retriever(collection_name: str = "synthara_default", k: int = 4):
    vectorstore = get_vectorstore(collection_name)
    retriever = vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": k}
    )
    return retriever