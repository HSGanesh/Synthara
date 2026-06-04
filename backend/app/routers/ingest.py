from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.rag.loader import load_file
from app.rag.chunker import chunk_documents
from app.rag.vectorstore import add_documents, list_collections
from app.config import settings
import shutil, os, jwt

router = APIRouter()


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    collection_name: str = "synthara_default",
    token: str = None,
    db: Session = Depends(get_db),
):
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

    # Update last_active_collection for the user
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            username = payload.get("sub")
            from app.models.db_models import User
            user = db.query(User).filter(User.username == username).first()
            if user:
                user.last_active_collection = collection_name
                db.commit()
        except Exception:
            pass

    return {
        "message": f"✅ '{file.filename}' ingested into collection '{collection_name}'",
        "chunks_created": len(chunks),
        "collection": collection_name,
    }


@router.get("/my-collections")
def get_my_collections(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")

        all_collections = list_collections()

        prefix = f"{username}__"
        user_collections = [
            col.replace(prefix, "")
            for col in all_collections
            if col.lower().startswith(prefix.lower())
        ]

        excluded = {"synthara_default", "default"}
        user_collections = [c for c in user_collections if c not in excluded]

        # Also return last_active_collection
        from app.models.db_models import User
        user = db.query(User).filter(User.username == username).first()
        last_active = user.last_active_collection if user else None
        # Strip username prefix from last_active if present
        if last_active and last_active.startswith(prefix):
            last_active = last_active.replace(prefix, "")

        return {
            "collections": user_collections,
            "last_active_collection": last_active,
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
