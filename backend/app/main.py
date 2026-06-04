from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, query, ingest, health, github
from app.database import engine, Base
import logging

logger = logging.getLogger("synthara")

# ── Create / migrate all tables (safe — skips existing) ───────────────────
Base.metadata.create_all(bind=engine)

# ── Safe column additions for existing deployments ────────────────────────
def safe_add_columns():
    """Add new columns to existing tables without dropping data."""
    from sqlalchemy import text, inspect
    inspector = inspect(engine)

    with engine.connect() as conn:
        # users.last_active_collection
        existing_user_cols = [c["name"] for c in inspector.get_columns("users")]
        if "last_active_collection" not in existing_user_cols:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN last_active_collection VARCHAR"))
                conn.commit()
                logger.info("Added column: users.last_active_collection")
            except Exception as e:
                logger.warning(f"Could not add last_active_collection: {e}")

        # chat_history.session_id (legacy compat)
        if inspector.has_table("chat_history"):
            existing_ch_cols = [c["name"] for c in inspector.get_columns("chat_history")]
            if "session_id" not in existing_ch_cols:
                try:
                    conn.execute(text("ALTER TABLE chat_history ADD COLUMN session_id VARCHAR"))
                    conn.commit()
                    logger.info("Added column: chat_history.session_id")
                except Exception as e:
                    logger.warning(f"Could not add session_id to chat_history: {e}")

try:
    safe_add_columns()
except Exception as e:
    logger.warning(f"safe_add_columns failed (non-fatal): {e}")

app = FastAPI(
    title="Synthara API",
    description="RAG-powered Developer Intelligence Platform",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["Ingest"])
app.include_router(query.router, prefix="/api/query", tags=["Query"])
app.include_router(github.router, prefix="/api/github", tags=["GitHub"])


@app.get("/")
def root():
    return {"message": "Welcome to Synthara API v3.0 🚀"}
