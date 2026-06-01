from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.rag.retriever import get_retriever
from app.config import settings

# Queries that should bypass RAG entirely
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

PROMPT_TEMPLATE = """
You are Synthara, an intelligent developer assistant.

Answer the user's question using the information provided in the context below.

Rules:
1. Use the context to answer. If the context contains relevant information, use it fully.
2. The context contains file contents from a software repository. 
   Questions about the project's purpose, aim, goal, what it does, overview — 
   these can be answered from README files, package.json, config files, or 
   any file that describes the project.
3. Only respond with "I don't have enough information in the current knowledge base." 
   if the context is genuinely empty or completely unrelated to the question.
4. Do not be overly strict. If the context gives partial clues about the answer, 
   synthesise a reasonable answer from those clues.
5. Use clean, concise formatting. Use bullet points when listing multiple items.
6. Use markdown code blocks for commands or code snippets.
7. Do NOT mention source file names in your answer.
8. Provide only the answer. Source information is handled separately.

Context:
{context}

Question:
{question}

Answer:
"""

def is_greeting(text: str) -> bool:
    cleaned = text.strip().lower().rstrip("!.,?")
    return cleaned in GREETING_PATTERNS

def format_docs(docs):
    return "\n\n".join(
        f"Source: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}"
        for doc in docs
    )

def get_rag_pipeline(collection_name: str = "synthara_default"):
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=settings.GROQ_API_KEY,
        temperature=0.2
    )

    retriever = get_retriever(collection_name=collection_name, k=6)

    prompt = PromptTemplate(
        template=PROMPT_TEMPLATE,
        input_variables=["context", "question"]
    )

    def run(question: str) -> dict:
        # Bypass RAG for greetings
        if is_greeting(question):
            return {"answer": GREETING_RESPONSE, "docs": []}

        from app.rag.retriever import get_retriever_for_query
        retriever, rewritten = get_retriever_for_query(question, collection_name=collection_name)
        docs = retriever.invoke(rewritten)
        context = format_docs(docs)
        chain = prompt | llm | StrOutputParser()
        answer = chain.invoke({"context": context, "question": question})

        return {"answer": answer, "docs": docs}

    return run