from pydantic import BaseModel

class QueryRequest(BaseModel):
    question: str
    collection_name: str = "synthara_default"

class QueryResponse(BaseModel):
    answer: str
    sources: list[str] = []
    collection: str = "synthara_default"