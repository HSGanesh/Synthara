from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, query, ingest, health
from app.database import engine, Base
from app.routers import auth, query, ingest, health, github  # add github

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Synthara API",
    description="RAG-powered Developer Intelligence Platform",
    version="2.0.0"
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
    return {"message": "Welcome to Synthara API v2.0 🚀"}