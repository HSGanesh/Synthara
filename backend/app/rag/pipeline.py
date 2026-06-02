import json
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.rag.retriever import get_retriever
from app.config import settings

# ---------------------------------------------------------------------------
# Greeting bypass
# ---------------------------------------------------------------------------

GREETING_PATTERNS = [
    "hi", "hello", "hey", "hii", "helo", "sup", "what's up", "whats up",
    "good morning", "good evening", "good afternoon", "good night",
    "howdy", "greetings", "yo", "hiya"
]

GREETING_RESPONSE = (
    "Hey! I'm Synthara, your developer intelligence assistant. "
    "I can answer questions about any codebase or repository you've ingested. "
    "Ask me anything — purpose of the project, how a function works, "
    "what a file contains, the tech stack, architecture, anything."
)

# ---------------------------------------------------------------------------
# Prompt — includes {history_block} slot for conversation memory
# ---------------------------------------------------------------------------

PROMPT_TEMPLATE = """
You are Synthara, an intelligent developer assistant.

{history_block}
Answer the user's question using the information provided in the context below.

Rules:
1. Use the context to answer. If the context contains relevant information, use it fully.
2. Refer to prior conversation turns if they are relevant to the current question.
3. Resolve pronouns like "its", "that file", "it", "them" using the conversation history.
4. The context contains file contents from a software repository.
   Questions about the project's purpose, aim, goal, what it does, overview —
   these can be answered from README files, package.json, config files, or
   any file that describes the project.
5. Only respond with "I don't have enough information in the current knowledge base."
   if the context is genuinely empty or completely unrelated to the question.
6. Do not be overly strict. If the context gives partial clues about the answer,
   synthesise a reasonable answer from those clues.
7. Use clean, concise formatting. Use bullet points when listing multiple items.
8. Use markdown code blocks for commands or code snippets.
9. Do NOT mention source file names in your answer.
10. Provide only the answer. Source information is handled separately.

Context:
{context}

Question:
{question}

Answer:
"""

# Keywords that suggest a structural / map-level question (Feature 4)
STRUCTURAL_KEYWORDS = (
    "where", "which file", "entry point", "entrypoint",
    "folder", "structure", "hooks", "components", "config",
    "where does", "where is", "where are",
)

# Pronouns that hint the user is referring to something from earlier (Feature 6)
REFERENCE_PRONOUNS = ("its", "it", "that", "this", "them", "their", "the file")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_greeting(text: str) -> bool:
    cleaned = text.strip().lower().rstrip("!.,?")
    return cleaned in GREETING_PATTERNS


def format_docs(docs) -> str:
    return "\n\n".join(
        f"Source: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
        for doc in docs
    )


def build_history_block(history: list) -> str:
    """Convert history list into a prompt-friendly string."""
    if not history:
        return ""
    lines = []
    for turn in history:
        role = "User" if turn.get("role") == "user" else "Synthara"
        lines.append(f"{role}: {turn.get('content', '')}")
    return "Conversation so far:\n" + "\n".join(lines) + "\n"


def resolve_question(question: str, history: list) -> str:
    """
    If the question uses a pronoun that refers to a previous context,
    prepend the last user message so the retriever can resolve it.
    """
    if not history:
        return question
    lower_q = question.lower()
    if any(pronoun in lower_q for pronoun in REFERENCE_PRONOUNS):
        last_user_msg = next(
            (t["content"] for t in reversed(history) if t.get("role") == "user"),
            None,
        )
        if last_user_msg:
            return f"{last_user_msg} — follow-up: {question}"
    return question


# ---------------------------------------------------------------------------
# Pipeline factory
# ---------------------------------------------------------------------------

def get_rag_pipeline(collection_name: str = "synthara_default"):
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=settings.GROQ_API_KEY,
        temperature=0.2,
    )

    # Kept for fallback; primary retrieval is now done inside run()
    _ = get_retriever(collection_name=collection_name, k=6)

    prompt = PromptTemplate(
        template=PROMPT_TEMPLATE,
        input_variables=["history_block", "context", "question"],
    )

    # Lazy import to avoid circular deps
    from app.rag.vectorstore import get_vectorstore
    vectorstore = get_vectorstore(collection_name)

    def run(question: str, history: list = None) -> dict:
        history = history or []

        # ── Greeting bypass ──────────────────────────────────────────────
        if is_greeting(question):
            return {"answer": GREETING_RESPONSE, "docs": []}

        # ── Feature 6: build history block + resolve pronouns ────────────
        history_block = build_history_block(history)
        resolved_question = resolve_question(question, history)

        # ── Feature 3 + 5: file-level retrieval / hybrid search ──────────
        from app.rag.retriever import get_retriever_for_query, hybrid_search
        retriever, rewritten, filename = get_retriever_for_query(
            resolved_question, collection_name=collection_name
        )

        # ── Feature 4: repo map fast-path for structural questions ────────
        if any(kw in resolved_question.lower() for kw in STRUCTURAL_KEYWORDS):
            try:
                map_docs = vectorstore.similarity_search(
                    "REPO_MAP",
                    k=1,
                    filter={"source": "__repo_map__"},
                )
                if map_docs:
                    map_data = json.loads(
                        map_docs[0].page_content.replace("REPO_MAP\n", "", 1)
                    )
                    context = f"Repository Map:\n{json.dumps(map_data, indent=2)}"
                    chain = prompt | llm | StrOutputParser()
                    answer = chain.invoke({
                        "history_block": history_block,
                        "context": context,
                        "question": question,
                    })
                    return {"answer": answer, "docs": map_docs}
            except Exception:
                pass  # fall through to normal retrieval if map lookup fails

        # ── Retrieval: file-scoped vs hybrid ─────────────────────────────
        if filename:
            # File-level query — use the metadata-filtered retriever directly
            docs = retriever.invoke(rewritten)
        else:
            # General query — BM25 + embedding hybrid search
            docs = hybrid_search(rewritten, collection_name=collection_name, k=6)

        # ── Generate answer ───────────────────────────────────────────────
        context = format_docs(docs)
        chain = prompt | llm | StrOutputParser()
        answer = chain.invoke({
            "history_block": history_block,
            "context": context,
            "question": question,
        })

        return {"answer": answer, "docs": docs}

    return run