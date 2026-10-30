from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class ChatSessionCreateRequest(BaseModel):
    title: Optional[str] = Field("Public Services Inquiry", max_length=255)

class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime

class ChatMessageCreateRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

class SourceReference(BaseModel):
    title: str
    source_url: Optional[str] = None
    last_reviewed: Optional[str] = None
    relevance_type: Optional[str] = "knowledge_base"

class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    sources: Optional[List[Dict[str, Any]]] = []
    created_at: datetime

class ChatSessionDetailResponse(ChatSessionResponse):
    messages: List[ChatMessageResponse] = []
