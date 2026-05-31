from langchain_community.embeddings import HuggingFaceEmbeddings

def get_embedder():
    embedder = HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"}
    )
    return embedder