from langchain_community.document_loaders import PyPDFLoader, TextLoader, DirectoryLoader
from langchain_core.documents import Document
import os

def load_pdf(file_path: str) -> list[Document]:
    loader = PyPDFLoader(file_path)
    return loader.load()

def load_text(file_path: str) -> list[Document]:
    loader = TextLoader(file_path, encoding="utf-8")
    return loader.load()

def load_directory(dir_path: str) -> list[Document]:
    loader = DirectoryLoader(
        dir_path,
        glob="**/*.{pdf,txt,md}",
        show_progress=True
    )
    return loader.load()

def load_file(file_path: str) -> list[Document]:
    ext = os.path.splitext(file_path)[-1].lower()
    if ext == ".pdf":
        return load_pdf(file_path)
    elif ext in [".txt", ".md"]:
        return load_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")