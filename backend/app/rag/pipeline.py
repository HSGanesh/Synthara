import json
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.rag.retriever import get_retriever
from qdrant_client.models import Filter, FieldCondition, MatchValue
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
Answer the user's question using ONLY the information provided in the context below.

Rules:
1. Use ONLY the context to answer. Never invent, infer, or guess facts that are not explicitly present in the context.
2. Refer to prior conversation turns if they are relevant to the current question.
3. Resolve pronouns like "its", "that file", "it", "them" using the conversation history.
4. The context contains file contents from a software repository or document.
   Questions about purpose, aim, goal, overview — answer from README, package.json, or config files.
5. CRITICAL — Grounding rule: If a specific fact (a number, name, date, score, value, version, etc.)
   is NOT explicitly written in the context, you MUST say you cannot find that information.
   Do NOT approximate, estimate, or guess. Do NOT use numbers from your training data.
6. If the context is empty or completely unrelated, respond:
   "I couldn't find that information in the ingested documents. Try asking something else or re-check the uploaded file."
7. Never say "based on my knowledge" or "typically" or "usually" when answering factual questions.
   If you don't see it in the context, say so clearly.
8. Use clean, concise formatting. Use bullet points when listing multiple items.
9. Use markdown code blocks for commands or code snippets.
10. Do NOT mention source file names in your answer.
11. Provide only the answer. Source information is handled separately.

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
# Hallucination guard
# ---------------------------------------------------------------------------

import re as _re

def _extract_numbers(text: str) -> set:
    """Pull every standalone number from a text string."""
    return set(_re.findall(r'\b\d+(?:\.\d+)?\b', text))

def hallucination_guard(answer: str, context: str, question: str) -> str:
    """
    Detect when the LLM produced a specific numeric or factual value that
    does NOT appear in the retrieved context — a strong signal for hallucination.

    Strategy:
      - Extract all numbers mentioned in the answer.
      - For each number, check whether it actually appears in the context.
      - If a significant number (>= 2 digits, or a decimal) appears in the
        answer but NOT in the context, append a grounding disclaimer.
    """
    answer_nums = _extract_numbers(answer)
    context_nums = _extract_numbers(context)

    # Numbers in the answer that are absent from the context
    ungrounded = {
        n for n in answer_nums
        if n not in context_nums and (len(n) >= 2 or "." in n)
    }

    if ungrounded:
        disclaimer = (
            "\n\n---\n"
            "⚠️ **Accuracy notice:** I couldn't verify this answer against the "
            "ingested documents. The specific value(s) above may not be accurate. "
            "Please cross-check with the original source."
        )
        return answer + disclaimer

    return answer

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
                # Filter by exact source match using Qdrant Filter
                _repo_map_filter = Filter(
                    must=[FieldCondition(key="metadata.source", match=MatchValue(value="__repo_map__"))]
                )
                map_docs = vectorstore.similarity_search(
                    "REPO_MAP",
                    k=1,
                    filter=_repo_map_filter,
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
            # If file-scoped retrieval returned nothing, widen to full collection
            if not docs:
                docs = vectorstore.similarity_search(rewritten, k=10)
        else:
            # General query — BM25 + embedding hybrid search
            docs = hybrid_search(rewritten, collection_name=collection_name, k=10)

        # ── Generate answer ───────────────────────────────────────────────
        context = format_docs(docs)
        chain = prompt | llm | StrOutputParser()
        answer = chain.invoke({
            "history_block": history_block,
            "context": context,
            "question": question,
        })

        # ── Hallucination guard ───────────────────────────────────────────
        # If the LLM produced a confident numeric/factual answer but the
        # context doesn't actually contain it, flag or suppress the answer.
        answer = hallucination_guard(answer, context, question)

        return {"answer": answer, "docs": docs}

    return run