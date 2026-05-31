from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from app.rag.retriever import get_retriever
from app.config import settings

PROMPT_TEMPLATE = """
You are Synthara, an intelligent developer assistant.

Answer the user's question using ONLY the information provided in the context.

Rules:

1. Do not use outside knowledge.
2. If the answer is not present in the context, respond exactly with:
   "I don't have enough information in the current knowledge base."
3. Use clean and concise formatting.
4. Use bullet points when listing multiple items.
5. Use markdown code blocks for commands or code snippets.
6. Do NOT mention source names throughout the answer.
7. Provide only the answer. Source information will be handled separately by the system.

Context:
{context}

Question:
{question}

Answer:
"""

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

    retriever = get_retriever(collection_name=collection_name, k=4)

    prompt = PromptTemplate(
        template=PROMPT_TEMPLATE,
        input_variables=["context", "question"]
    )

    chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain