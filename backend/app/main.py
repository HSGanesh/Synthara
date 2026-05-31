from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, query, ingest, health

app = FastAPI(
    title="Synthara API",
    description="RAG-powered Developer Intelligence Platform",
    version="1.0.0"
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

@app.get("/")
def root():
    return {"message": "Welcome to Synthara API 🚀"}