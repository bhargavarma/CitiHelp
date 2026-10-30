from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.grievance import GrievanceResponse


class CategoryDistribution(BaseModel):
    category: str
    count: int


class AdminActivityItem(BaseModel):
    """A single status change shown in the dashboard activity feed."""

    id: str
    grievance_id: str
    reference_number: str
    subject: str
    old_status: Optional[str] = None
    new_status: str
    remarks: Optional[str] = None
    changed_by_name: Optional[str] = None
    created_at: datetime


class AdminDashboardStats(BaseModel):
    total_grievances: int
    submitted: int
    under_review: int
    in_progress: int
    resolved: int
    rejected: int
    pending: int
    category_distribution: List[CategoryDistribution] = Field(default_factory=list)
    recent_grievances: List[GrievanceResponse] = Field(default_factory=list)
    recent_updates: List[AdminActivityItem] = Field(default_factory=list)
