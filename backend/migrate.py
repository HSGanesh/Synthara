"""
One-time migration script: converts legacy chat_history rows into
Conversation + Message rows.

Run ONCE after deploying the new backend:
    python migrate.py

Safe to run multiple times — skips already-migrated sessions.
"""

import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, Base, SessionLocal
from app.models.db_models import ChatHistory, Conversation, Message, User
from sqlalchemy import text
from datetime import datetime
import json

def migrate():
    # Create new tables if they don't exist yet
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if chat_history has any rows
        legacy_rows = db.query(ChatHistory).order_by(ChatHistory.created_at.asc()).all()
        if not legacy_rows:
            print("No legacy chat_history rows found. Nothing to migrate.")
            return

        print(f"Found {len(legacy_rows)} legacy rows — migrating...")

        # Index existing conversations so we don't duplicate
        existing_sessions = {
            c.session_id for c in db.query(Conversation.session_id).all()
        }

        # Group by session_id (fallback: str(id) for old rows without session_id)
        sessions: dict[str, list[ChatHistory]] = {}
        for row in legacy_rows:
            sid = row.session_id or str(row.id)
            sessions.setdefault(sid, []).append(row)

        migrated_convs = 0
        migrated_msgs = 0

        for sid, rows in sessions.items():
            if sid in existing_sessions:
                print(f"  skip  session {sid} — already migrated")
                continue

            first = rows[0]
            # Try to find the user
            user = db.query(User).filter(User.id == first.user_id).first()
            username = user.username if user else "unknown"

            title = first.question[:60].strip().capitalize()
            if len(first.question) > 60:
                title = title[:57].rstrip() + "..."

            conv = Conversation(
                session_id=sid,
                user_id=first.user_id,
                collection=first.collection or "synthara_default",
                title=title,
                created_at=first.created_at,
                updated_at=rows[-1].created_at,
            )
            db.add(conv)
            db.flush()

            for row in rows:
                msg = Message(
                    conversation_id=conv.id,
                    question=row.question,
                    answer=row.answer,
                    sources=row.sources or "[]",
                    created_at=row.created_at,
                )
                db.add(msg)
                migrated_msgs += 1

            migrated_convs += 1

        db.commit()
        print(f"✅ Migration complete: {migrated_convs} conversations, {migrated_msgs} messages.")

    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
