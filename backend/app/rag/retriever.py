import re
from app.rag.vectorstore import get_vectorstore
from qdrant_client.models import Filter, FieldCondition, MatchText, MatchValue

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

# Extensions that hint a token is a filename
FILE_EXTENSIONS = (
    ".py", ".ts", ".tsx", ".js", ".jsx", ".md", ".json",
    ".yaml", ".yml", ".toml", ".html", ".css", ".sh",
    ".txt", ".go", ".rs", ".java", ".rb", ".php",
)


def rewrite_query(query: str) -> str:
    rewritten = query
    for pattern, replacement in INTENT_REWRITES.items():
        rewritten = re.sub(pattern, replacement, rewritten, flags=re.IGNORECASE)
    return rewritten.strip()


def extract_filename(query: str) -> str | None:
    """
    Detect if the query references a specific filename.
    e.g. 'Explain main.tsx' -> 'main.tsx'
         'What does useSpeechRecognitionEngine.ts do?' -> 'useSpeechRecognitionEngine.ts'
         'Summarize README' -> 'README'  (extensionless special case)
    """
    # Match tokens that look like filenames (with extension)
    matches = re.findall(
        r'\b[\w\-]+(?:\.' + '|'.join(ext.lstrip('.') for ext in FILE_EXTENSIONS) + r')\b',
        query,
        flags=re.IGNORECASE,
    )
    if matches:
        return matches[0]

    # Extensionless special cases
    bare = re.findall(r'\b(README|CHANGELOG|LICENCE|LICENSE|Makefile|Dockerfile)\b', query)
    if bare:
        return bare[0]

    return None


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
    filename = extract_filename(query)
    vectorstore = get_vectorstore(collection_name)

    if filename:
        # File-level retrieval: use similarity_search directly with a Qdrant filter.
        # We wrap it in a custom callable retriever to avoid MMR+filter incompatibility.
        # MMR internally calls query_points which doesn't support all filter types.
        qdrant_filter = Filter(
            must=[
                FieldCondition(
                    key="metadata.source",
                    match=MatchText(text=filename),
                )
            ]
        )

        class _FileRetriever:
            """Thin wrapper so pipeline can call .invoke() on a file-scoped search."""
            def __init__(self, vs, filt, k, filename):
                self._vs = vs
                self._filter = filt
                self._k = k
                self._filename = filename

            def invoke(self, query):
                # Fetch more docs then filter by filename in Python
                # avoids all Qdrant filter version incompatibilities
                all_docs = self._vs.similarity_search(query, k=self._k * 4)
                filtered = [
                    doc for doc in all_docs
                    if self._filename.lower() in doc.metadata.get("source", "").lower()
                ]
                return filtered if filtered else all_docs[:self._k]

        retriever = _FileRetriever(vectorstore, qdrant_filter, k, filename)
        # Rewrite query to focus on the file content itself
        rewritten = f"{rewritten} {filename} file contents"
    else:
        retriever = vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": k,
                "fetch_k": k * 5,
                "lambda_mult": 0.7,
            }
        )

    return retriever, rewritten, filename  # filename exposed for callers


from rank_bm25 import BM25Okapi

def hybrid_search(query: str, collection_name: str = "synthara_default", k: int = 6) -> list:
    """
    BM25 + embedding MMR retrieval, merged and reranked by combined score.
    """
    vectorstore = get_vectorstore(collection_name)

    # 1. Embedding-based retrieval (fetch more for merging)
    embedding_docs = vectorstore.similarity_search_with_score(query, k=k * 3)

    if not embedding_docs:
        return []

    # Normalise embedding scores (lower distance = better, invert)
    max_score = max(score for _, score in embedding_docs) or 1.0
    embedding_scored = {
        doc.metadata.get("source", "") + doc.page_content[:50]: (doc, 1 - (score / max_score))
        for doc, score in embedding_docs
    }

    # 2. BM25 over the retrieved set
    corpus = [doc.page_content for doc, _ in embedding_docs]
    tokenized_corpus = [text.lower().split() for text in corpus]
    bm25 = BM25Okapi(tokenized_corpus)
    tokenized_query = query.lower().split()
    bm25_scores = bm25.get_scores(tokenized_query)

    # Normalise BM25 scores
    max_bm25 = max(bm25_scores) or 1.0
    bm25_normalised = [s / max_bm25 for s in bm25_scores]

    # 3. Combine scores (60% embedding, 40% BM25)
    combined = []
    for i, (doc, _) in enumerate(embedding_docs):
        key = doc.metadata.get("source", "") + doc.page_content[:50]
        emb_score = embedding_scored.get(key, (doc, 0))[1]
        final_score = 0.6 * emb_score + 0.4 * bm25_normalised[i]
        combined.append((doc, final_score))

    # Sort descending by combined score
    combined.sort(key=lambda x: x[1], reverse=True)

    # Dedup by content fingerprint (not source) so multi-chunk single-file
    # documents (e.g. resumes, PDFs) aren't collapsed to just one chunk.
    # We still cap each source at max_per_source chunks to ensure diversity.
    max_per_source = 4
    source_counts: dict = {}
    seen_content, results = set(), []
    for doc, score in combined:
        source = doc.metadata.get("source", "")
        fingerprint = doc.page_content[:80]
        if fingerprint in seen_content:
            continue
        if source_counts.get(source, 0) >= max_per_source:
            continue
        seen_content.add(fingerprint)
        source_counts[source] = source_counts.get(source, 0) + 1
        results.append(doc)
        if len(results) >= k:
            break

    return results