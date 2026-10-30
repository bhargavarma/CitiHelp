import uuid
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User

GRIEVANCE_STATUSES_SQL = "'Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'"

class Grievance(Base, TimestampMixin):
    __tablename__ = "grievances"
    __table_args__ = (
        CheckConstraint(
            f"current_status IN ({GRIEVANCE_STATUSES_SQL})",
            name="ck_grievances_current_status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reference_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    attachment_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    current_status: Mapped[str] = mapped_column(String(50), default="Submitted", nullable=False, index=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="grievances")
    history: Mapped[List["GrievanceHistory"]] = relationship("GrievanceHistory", back_populates="grievance", cascade="all, delete-orphan", order_by="GrievanceHistory.created_at")

class GrievanceHistory(Base, TimestampMixin):
    __tablename__ = "grievance_history"
    __table_args__ = (
        CheckConstraint(
            f"new_status IN ({GRIEVANCE_STATUSES_SQL})",
            name="ck_grievance_history_new_status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    grievance_id: Mapped[str] = mapped_column(String(36), ForeignKey("grievances.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    old_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    grievance: Mapped["Grievance"] = relationship("Grievance", back_populates="history")
    changer: Mapped[Optional["User"]] = relationship("User", back_populates="status_updates")
