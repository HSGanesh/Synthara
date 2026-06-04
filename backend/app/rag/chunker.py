from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document


# Document-type heuristics based on source filename
def _looks_like_resume_or_doc(source: str) -> bool:
    lower = source.lower()
    return any(kw in lower for kw in ["resume", "cv", "profile", "bio", ".pdf", ".txt", ".md"])


def chunk_documents(documents: list[Document]) -> list[Document]:
    """
    Adaptive chunking:
    - Code files    → 500 chars, 100 overlap  (dense, precise)
    - Docs/resumes  → 1200 chars, 200 overlap (keep facts together)
    - Default       → 800 chars, 150 overlap
    
    Larger chunks for text documents mean factual data like "CGPA: 8.26"
    stays in context with surrounding sentences, scoring higher in retrieval
    rather than being isolated in a tiny low-scoring chunk.
    """
    code_extensions = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs",
                       ".java", ".rb", ".php", ".sh", ".yaml", ".yml", ".json", ".toml"}

    # Separate docs into groups
    code_docs, text_docs = [], []
    for doc in documents:
        source = doc.metadata.get("source", "")
        ext = "." + source.rsplit(".", 1)[-1].lower() if "." in source else ""
        if ext in code_extensions:
            code_docs.append(doc)
        else:
            text_docs.append(doc)

    all_chunks = []

    # Code: keep chunks tight so code snippets aren't truncated mid-function
    if code_docs:
        code_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " ", ""],
        )
        all_chunks.extend(code_splitter.split_documents(code_docs))

    # Text / documents: larger window so factual sentences are not isolated
    if text_docs:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1200,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", ".", " ", ""],
        )
        all_chunks.extend(text_splitter.split_documents(text_docs))

    print(f"✅ Total chunks created: {len(all_chunks)} "
          f"(code: {len(code_docs)} src docs → ~{len(code_docs)*2} chunks, "
          f"text: {len(text_docs)} src docs → ~{len(text_docs)*2} chunks)")
    return all_chunks
