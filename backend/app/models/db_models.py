from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active_collection = Column(String, nullable=True)  # tracks most recent collection

    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    """One conversation = one sidebar entry, can contain many messages."""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    collection = Column(String, nullable=False, default="synthara_default")
    title = Column(String, nullable=True)          # AI-generated from first message
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation",
                            cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    """A single user↔assistant exchange within a conversation."""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


# ── Legacy table kept so existing data isn't wiped ────────────────────────
class ChatHistory(Base):
    """Legacy table — kept for backward compat. New code uses Conversation+Message."""
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(String, nullable=True)
    collection = Column(String, default="synthara_default")
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
