from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.rag.github_loader import (
    clone_repo,
    load_repo_files,
    cleanup_repo,
    get_repo_name
)
from app.rag.chunker import chunk_documents
from app.rag.vectorstore import add_documents
from app.database import get_db
from app.config import settings
import jwt

router = APIRouter()


class GitHubImportRequest(BaseModel):
    repo_url: str
    collection_name: str
    token: str


@router.post("/import")
def import_github_repo(
    request: GitHubImportRequest,
    db: Session = Depends(get_db)
):
    # Verify JWT token
    try:
        payload = jwt.decode(
            request.token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        username = payload.get("sub")

        if not username:
            raise HTTPException(
                status_code=401,
                detail="Invalid token payload"
            )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    # Validate GitHub URL
    if not request.repo_url.startswith("https://github.com/"):
        raise HTTPException(
            status_code=400,
            detail="Only GitHub repository URLs are supported"
        )

    parts = request.repo_url.rstrip("/").split("/")

    # Expected:
    # https://github.com/username/repository
    if len(parts) < 5:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub repository URL"
        )

    repo_name = get_repo_name(request.repo_url)

    # User-scoped collection
    scoped_collection = (
        f"{username}__{request.collection_name}"
    )

    repo_path = None

    try:
        # Clone repository
        repo_path = clone_repo(
            request.repo_url
        )

        # Load repository files
        documents = load_repo_files(
            repo_path,
            request.repo_url
        )

        if not documents:
            raise HTTPException(
                status_code=400,
                detail="No supported files found in repository"
            )

        # Chunk documents
        chunks = chunk_documents(
            documents
        )

        # Store in ChromaDB
        add_documents(
            chunks,
            collection_name=scoped_collection
        )

        return {
            "message": "✅ Repository imported successfully",
            "repo_name": repo_name,
            "repo_url": request.repo_url,
            "collection": request.collection_name,
            "scoped_collection": scoped_collection,
            "files_loaded": len(documents),
            "chunks_created": len(chunks)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {str(e)}"
        )

    finally:
        if repo_path:
            cleanup_repo(repo_path)