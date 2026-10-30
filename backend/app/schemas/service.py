from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    department: str
    description: str
    eligibility: str
    required_documents: List[str]
    procedure: str
    source_url: Optional[str] = None
    last_reviewed: str
    is_verified: bool
    created_at: datetime
    updated_at: datetime

class ServiceListResponse(BaseModel):
    items: List[ServiceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class ServiceCategoriesResponse(BaseModel):
    categories: List[str]
