from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CHROMA_DB_PATH: str = "./chroma_db"
    UPLOAD_DIR: str = "./uploads"
    DATABASE_URL: str = "sqlite:///./synthara.db"   # default fallback for local dev
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    class Config:
        env_file = ".env"

settings = Settings()