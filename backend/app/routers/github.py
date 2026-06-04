from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.rag.github_loader import (
    clone_repo, load_repo_files, cleanup_repo, get_repo_name
)
from app.rag.chunker import chunk_documents
from app.rag.vectorstore import add_documents
from app.database import get_db
from app.config import settings
import jwt, json
from app.rag.github_loader import generate_repo_map

router = APIRouter()


class GitHubImportRequest(BaseModel):
    repo_url: str
    collection_name: str
    token: str


@router.post("/import")
def import_github_repo(request: GitHubImportRequest, db: Session = Depends(get_db)):
    # Verify JWT
    try:
        payload = jwt.decode(request.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not request.repo_url.startswith("https://github.com/"):
        raise HTTPException(status_code=400, detail="Only GitHub repository URLs are supported")

    parts = request.repo_url.rstrip("/").split("/")
    if len(parts) < 5:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

    repo_name = get_repo_name(request.repo_url)
    scoped_collection = f"{username}__{request.collection_name}"
    repo_path = None

    try:
        repo_path = clone_repo(request.repo_url)
        documents = load_repo_files(repo_path, request.repo_url)

        if not documents:
            raise HTTPException(status_code=400, detail="No supported files found in repository")

        chunks = chunk_documents(documents)

        # Generate and store repo map
        repo_map = generate_repo_map(documents)
        repo_map["repo_name"] = repo_name
        repo_map["repo_url"] = request.repo_url

        from langchain_core.documents import Document as LCDocument
        map_doc = LCDocument(
            page_content=f"REPO_MAP\n{json.dumps(repo_map, indent=2)}",
            metadata={"source": "__repo_map__", "file": "__repo_map__", "type": "repo_map"},
        )
        add_documents(chunks + [map_doc], collection_name=scoped_collection)

        # Track last active collection for the user
        try:
            from app.models.db_models import User
            user = db.query(User).filter(User.username == username).first()
            if user:
                user.last_active_collection = scoped_collection
                db.commit()
        except Exception:
            pass

        return {
            "message": "✅ Repository imported successfully",
            "repo_name": repo_name,
            "repo_url": request.repo_url,
            "collection": request.collection_name,
            "scoped_collection": scoped_collection,
            "files_loaded": len(documents),
            "chunks_created": len(chunks),
            "repo_map": repo_map,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if repo_path:
            cleanup_repo(repo_path)
