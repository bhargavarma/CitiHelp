import math
from datetime import date, datetime, time
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, case, desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_admin
from app.database.session import get_db
from app.models.grievance import Grievance, GrievanceHistory
from app.models.user import User
from app.schemas.admin import (
    AdminActivityItem,
    AdminDashboardStats,
    CategoryDistribution,
)
from app.schemas.grievance import (
    GrievanceDetailResponse,
    GrievanceHistoryResponse,
    GrievanceListResponse,
    GrievanceResponse,
    GrievanceStatusUpdateRequest,
)

router = APIRouter(prefix="/admin", tags=["Administrative Portal"])

VALID_STATUSES = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"]

STATUS_SORT_ORDER = case(
    (Grievance.current_status == "Submitted", 1),
    (Grievance.current_status == "Under Review", 2),
    (Grievance.current_status == "In Progress", 3),
    (Grievance.current_status == "Resolved", 4),
    (Grievance.current_status == "Rejected", 5),
    else_=99,
)


def normalize_status(value: str) -> Optional[str]:
    """Return the canonical status label or ``None`` when it is not supported."""
    cleaned = value.strip().lower()
    for allowed in VALID_STATUSES:
        if allowed.lower() == cleaned:
            return allowed
    return None


def parse_status_filter(value: Optional[str]) -> List[str]:
    """Parse a single status or a comma-separated status group.

    ``status=Submitted,Under Review,In Progress`` is used by the pending queue,
    while a single value keeps the classic behaviour.
    """
    if not value or not value.strip():
        return []

    statuses: List[str] = []
    for raw in value.split(","):
        candidate = raw.strip()
        if not candidate:
            continue
        normalized = normalize_status(candidate)
        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid status '{candidate}'. Must be one of: "
                    f"{', '.join(VALID_STATUSES)}"
                ),
            )
        if normalized not in statuses:
            statuses.append(normalized)
    return statuses


def serialize_grievance(grievance: Grievance) -> GrievanceResponse:
    item = GrievanceResponse.model_validate(grievance)
    item.citizen_name = grievance.user.full_name if grievance.user else None
    item.citizen_email = grievance.user.email if grievance.user else None
    return item


def serialize_history(record: GrievanceHistory) -> GrievanceHistoryResponse:
    item = GrievanceHistoryResponse.model_validate(record)
    item.changed_by_name = record.changer.full_name if record.changer else "System / Citizen"
    return item


def serialize_detail(grievance: Grievance) -> GrievanceDetailResponse:
    detail = GrievanceDetailResponse.model_validate(grievance)
    detail.citizen_name = grievance.user.full_name if grievance.user else None
    detail.citizen_email = grievance.user.email if grievance.user else None
    # Chronological order: oldest record first, newest action last.
    ordered = sorted(grievance.history, key=lambda h: h.created_at)
    detail.history = [serialize_history(record) for record in ordered]
    return detail


def recent_grievances(db: Session, limit: int = 5) -> List[GrievanceResponse]:
    stmt = (
        select(Grievance)
        .options(selectinload(Grievance.user))
        .order_by(desc(Grievance.created_at))
        .limit(limit)
    )
    return [serialize_grievance(g) for g in db.scalars(stmt).all()]


def recent_status_updates(db: Session, limit: int = 5) -> List[AdminActivityItem]:
    stmt = (
        select(
            GrievanceHistory,
            Grievance.reference_number,
            Grievance.subject,
            User.full_name,
        )
        .join(Grievance, Grievance.id == GrievanceHistory.grievance_id)
        .outerjoin(User, User.id == GrievanceHistory.changed_by)
        .order_by(desc(GrievanceHistory.created_at))
        .limit(limit)
    )
    updates: List[AdminActivityItem] = []
    for record, reference_number, subject, changer_name in db.execute(stmt).all():
        updates.append(
            AdminActivityItem(
                id=record.id,
                grievance_id=record.grievance_id,
                reference_number=reference_number,
                subject=subject,
                old_status=record.old_status,
                new_status=record.new_status,
                remarks=record.remarks,
                changed_by_name=changer_name or "System / Citizen",
                created_at=record.created_at,
            )
        )
    return updates


@router.get("/stats", response_model=AdminDashboardStats)
@router.get("/analytics", response_model=AdminDashboardStats)
def get_admin_dashboard_stats(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_count = db.scalar(select(func.count(Grievance.id))) or 0

    status_counts_res = db.execute(
        select(Grievance.current_status, func.count(Grievance.id)).group_by(
            Grievance.current_status
        )
    ).all()
    status_dict = {row[0]: row[1] for row in status_counts_res}

    cat_res = db.execute(
        select(Grievance.category, func.count(Grievance.id))
        .group_by(Grievance.category)
        .order_by(desc(func.count(Grievance.id)), asc(Grievance.category))
    ).all()
    category_distribution = [
        CategoryDistribution(category=row[0], count=row[1]) for row in cat_res
    ]

    submitted = status_dict.get("Submitted", 0)
    under_review = status_dict.get("Under Review", 0)
    in_progress = status_dict.get("In Progress", 0)

    return AdminDashboardStats(
        total_grievances=total_count,
        submitted=submitted,
        under_review=under_review,
        in_progress=in_progress,
        resolved=status_dict.get("Resolved", 0),
        rejected=status_dict.get("Rejected", 0),
        pending=submitted + under_review + in_progress,
        category_distribution=category_distribution,
        recent_grievances=recent_grievances(db),
        recent_updates=recent_status_updates(db),
    )


@router.get("/grievances", response_model=GrievanceListResponse)
def list_all_grievances(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status_filter: Optional[str] = Query(None, alias="status"),
    category_filter: Optional[str] = Query(None, alias="category"),
    search: Optional[str] = Query(None, max_length=255),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sort: Literal["newest", "oldest", "status"] = Query("newest"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be on or before date_to.",
        )

    statuses = parse_status_filter(status_filter)

    # Join the citizen so administrators can search by name and email.
    query = (
        select(Grievance)
        .join(User, User.id == Grievance.user_id)
        .options(selectinload(Grievance.user))
    )
    count_query = select(func.count(Grievance.id)).join(
        User, User.id == Grievance.user_id
    )

    filters = []
    if statuses:
        filters.append(Grievance.current_status.in_(statuses))
    if category_filter and category_filter.strip():
        filters.append(Grievance.category.ilike(category_filter.strip()))
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Grievance.reference_number.ilike(term),
                Grievance.subject.ilike(term),
                Grievance.description.ilike(term),
                Grievance.category.ilike(term),
                Grievance.location.ilike(term),
                User.full_name.ilike(term),
                User.email.ilike(term),
            )
        )
    if date_from:
        filters.append(Grievance.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        filters.append(Grievance.created_at <= datetime.combine(date_to, time.max))

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = db.scalar(count_query) or 0

    if sort == "oldest":
        query = query.order_by(asc(Grievance.created_at), asc(Grievance.id))
    elif sort == "status":
        query = query.order_by(
            STATUS_SORT_ORDER, desc(Grievance.created_at), asc(Grievance.id)
        )
    else:
        query = query.order_by(desc(Grievance.created_at), asc(Grievance.id))

    grievances = db.scalars(
        query.offset((page - 1) * page_size).limit(page_size)
    ).all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return GrievanceListResponse(
        items=[serialize_grievance(g) for g in grievances],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/grievances/{grievance_id}/history",
    response_model=List[GrievanceHistoryResponse],
)
def get_admin_grievance_history(
    grievance_id: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    grievance = db.scalar(select(Grievance).where(Grievance.id == grievance_id))
    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found"
        )

    records = db.scalars(
        select(GrievanceHistory)
        .options(selectinload(GrievanceHistory.changer))
        .where(GrievanceHistory.grievance_id == grievance_id)
        .order_by(asc(GrievanceHistory.created_at))
    ).all()

    return [serialize_history(record) for record in records]


@router.get("/grievances/{grievance_id}", response_model=GrievanceDetailResponse)
def get_admin_grievance_detail(
    grievance_id: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    grievance = db.scalar(
        select(Grievance)
        .options(
            selectinload(Grievance.history).selectinload(GrievanceHistory.changer),
            selectinload(Grievance.user),
        )
        .where(Grievance.id == grievance_id)
    )

    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found"
        )

    return serialize_detail(grievance)


@router.patch(
    "/grievances/{grievance_id}/status", response_model=GrievanceDetailResponse
)
def update_grievance_status(
    grievance_id: str,
    payload: GrievanceStatusUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    grievance = db.scalar(
        select(Grievance)
        .options(
            selectinload(Grievance.history).selectinload(GrievanceHistory.changer),
            selectinload(Grievance.user),
        )
        .where(Grievance.id == grievance_id)
    )

    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found"
        )

    matched_status = normalize_status(payload.status)
    if not matched_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status '{payload.status}'. Must be one of: "
                f"{', '.join(VALID_STATUSES)}"
            ),
        )

    old_status = grievance.current_status
    grievance.current_status = matched_status

    remarks = payload.remarks.strip() if payload.remarks else ""
    history_entry = GrievanceHistory(
        grievance_id=grievance.id,
        changed_by=admin_user.id,
        old_status=old_status,
        new_status=matched_status,
        remarks=remarks or f"Status changed to {matched_status} by administrative authority.",
    )
    db.add(history_entry)

    db.commit()
    db.refresh(grievance)

    return get_admin_grievance_detail(grievance_id, admin_user, db)
