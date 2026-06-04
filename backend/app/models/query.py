from pydantic import BaseModel
from typing import Optional, List


class ConversationTurn(BaseModel):
    role: str        # "user" or "assistant"
    content: str


class QueryRequest(BaseModel):
    question: str
    collection_name: str = "synthara_default"
    token: Optional[str] = None
    session_id: Optional[str] = None
    history: Optional[List[ConversationTurn]] = []
    conversation_title: Optional[str] = None   # client can pass pre-computed title


class QueryResponse(BaseModel):
    answer: str
    sources: list[str] = []
    collection: str = "synthara_default"
    session_id: Optional[str] = None
    conversation_title: Optional[str] = None
