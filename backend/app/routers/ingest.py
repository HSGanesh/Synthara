from fastapi import APIRouter, UploadFile, File, HTTPException
from app.rag.loader import load_file
from app.rag.chunker import chunk_documents
from app.rag.vectorstore import add_documents, list_collections
from app.config import settings
import shutil, os

router = APIRouter()

# Track last uploaded collection
last_collection = {"name": "synthara_default"}

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), collection_name: str = "synthara_default"):
    allowed = [".pdf", ".txt", ".md"]
    ext = os.path.splitext(file.filename)[-1].lower()

    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF, TXT, MD files allowed")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    documents = load_file(file_path)
    chunks = chunk_documents(documents)
    add_documents(chunks, collection_name=collection_name)

    # Update last uploaded collection
    last_collection["name"] = collection_name

    return {
        "message": f"✅ '{file.filename}' ingested into collection '{collection_name}'",
        "chunks_created": len(chunks),
        "collection": collection_name
    }

@router.get("/collections")
def get_collections():
    collections = list_collections()
    return {"collections": collections}

@router.get("/last-collection")
def get_last_collection():
    return {"collection": last_collection["name"]}