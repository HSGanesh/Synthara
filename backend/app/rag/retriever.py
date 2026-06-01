import re
from app.rag.vectorstore import get_vectorstore

# Maps vague intent words to concrete retrieval terms
INTENT_REWRITES = {
    r"\baim\b": "purpose goal what does",
    r"\bpurpose\b": "purpose goal what does overview",
    r"\bgoal\b": "purpose goal what does overview",
    r"\bobject(ive)?\b": "purpose goal what does overview",
    r"\bmeaning\b": "purpose what does overview",
    r"\bwhat (is|does) (this|the) (project|app|tool|system|repo)\b": "purpose overview README what does",
    r"\bsummariz(e|ing)\b": "overview summary contents",
    r"\bexplain\b": "overview description what does how",
    r"\btell me about\b": "overview description",
    r"\bdescribe\b": "overview description contents",
    r"\boverview\b": "overview summary description",
}

def rewrite_query(query: str) -> str:
    rewritten = query
    for pattern, replacement in INTENT_REWRITES.items():
        rewritten = re.sub(pattern, replacement, rewritten, flags=re.IGNORECASE)
    return rewritten.strip()

def get_retriever(collection_name: str = "synthara_default", k: int = 6):
    vectorstore = get_vectorstore(collection_name)
    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": k,
            "fetch_k": k * 5,
            "lambda_mult": 0.7,
        }
    )
    return retriever

def get_retriever_for_query(query: str, collection_name: str = "synthara_default", k: int = 6):
    rewritten = rewrite_query(query)
    vectorstore = get_vectorstore(collection_name)
    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": k,
            "fetch_k": k * 5,
            "lambda_mult": 0.7,
        }
    )
    return retriever, rewritten