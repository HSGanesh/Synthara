from pydantic import BaseModel
from typing import Optional

class QueryRequest(BaseModel):
    question: str
    collection_name: str = "synthara_default"
    token: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    sources: list[str] = []
    collection: str = "synthara_default"