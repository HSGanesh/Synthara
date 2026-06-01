from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
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

@router.get("/my-collections")
def get_my_collections(token: str, db: Session = Depends(get_db)):
    try:
        import jwt
        from app.models.db_models import User

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")

        all_collections = list_collections()

        prefix = f"{username}__"
        user_collections = [
            col.replace(prefix, "")
            for col in all_collections
            if col.startswith(prefix)  # strictly only user's collections
        ]

        # Filter out any leftover default names
        excluded = {"synthara_default", "default"}
        user_collections = [c for c in user_collections if c not in excluded]

        return {"collections": user_collections}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
