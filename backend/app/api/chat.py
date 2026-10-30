from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.user import User
from app.models.chat import ChatSession, ChatMessage
from app.schemas.chat import (
    ChatSessionCreateRequest,
    ChatSessionResponse,
    ChatMessageCreateRequest,
    ChatMessageResponse
)
from app.services.ai_service import answer_citizen_query
from app.core.deps import get_current_user

router = APIRouter(prefix="/chat", tags=["AI Public Service Assistant"])

@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    payload: ChatSessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = ChatSession(
        user_id=current_user.id,
        title=payload.title or "Public Service Inquiry"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/sessions", response_model=List[ChatSessionResponse])
def list_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(desc(ChatSession.created_at))
    )
    return db.scalars(stmt).all()

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.scalar(select(ChatSession).where(ChatSession.id == session_id))
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return db.scalars(stmt).all()

@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
def send_chat_message(
    session_id: str,
    payload: ChatMessageCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.scalar(select(ChatSession).where(ChatSession.id == session_id))
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=payload.message.strip(),
        sources=[]
    )
    db.add(user_msg)
    db.flush()

    answer_text, sources = answer_citizen_query(db, payload.message.strip())

    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=answer_text,
        sources=sources
    )
    db.add(assistant_msg)

    if session.title == "Public Service Inquiry" and len(payload.message) > 3:
        clean_title = payload.message.strip()[:40]
        session.title = f"Q: {clean_title}..."

    db.commit()
    db.refresh(assistant_msg)

    return assistant_msg

@router.post("", response_model=ChatMessageResponse)
def direct_chat(
    payload: ChatMessageCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(desc(ChatSession.created_at))
        .limit(1)
    )
    session = db.scalar(stmt)

    if not session:
        session = ChatSession(
            user_id=current_user.id,
            title="Public Service Inquiry"
        )
        db.add(session)
        db.flush()

    return send_chat_message(session.id, payload, current_user, db)

@router.get("/history", response_model=List[ChatMessageResponse])
def get_general_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stmt = (
        select(ChatMessage)
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(30)
    )
    messages = db.scalars(stmt).all()
    return list(reversed(messages))
