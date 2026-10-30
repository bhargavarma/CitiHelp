from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class GrievanceCreateRequest(BaseModel):
    subject: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=15, max_length=5000)
    category: str = Field(..., min_length=2, max_length=100)
    location: str = Field(..., min_length=3, max_length=255)
    attachment_path: Optional[str] = Field(
        None,
        max_length=500,
        pattern=r"^/uploads/[A-Za-z0-9_.-]+$",
        description="Path returned by POST /grievances/attachments",
    )

class GrievanceHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    old_status: Optional[str] = None
    new_status: str
    remarks: Optional[str] = None
    changed_by_name: Optional[str] = None
    created_at: datetime

class GrievanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reference_number: str
    subject: str
    description: str
    category: str
    location: str
    attachment_path: Optional[str] = None
    current_status: str
    created_at: datetime
    updated_at: datetime
    citizen_name: Optional[str] = None
    citizen_email: Optional[str] = None

class GrievanceDetailResponse(GrievanceResponse):
    history: List[GrievanceHistoryResponse] = []

class GrievanceListResponse(BaseModel):
    items: List[GrievanceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class GrievanceSummaryResponse(BaseModel):
    total: int
    submitted: int
    under_review: int
    in_progress: int
    resolved: int
    rejected: int

class GrievanceStatusUpdateRequest(BaseModel):
    status: str = Field(..., min_length=2, max_length=50)
    remarks: Optional[str] = Field(None, max_length=2000)
