import math
import random
import string
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select, func, or_, desc
from sqlalchemy.orm import Session, selectinload
from app.core.config import settings
from app.database.session import get_db
from app.models.user import User
from app.models.grievance import Grievance, GrievanceHistory
from app.schemas.grievance import (
    GrievanceCreateRequest,
    GrievanceResponse,
    GrievanceDetailResponse,
    GrievanceListResponse,
    GrievanceHistoryResponse,
    GrievanceSummaryResponse
)
from app.core.deps import get_current_user, require_citizen

router = APIRouter(prefix="/grievances", tags=["Grievance Redressal"])

GRIEVANCE_CATEGORIES = [
    "Municipal Services",
    "Water Supply & Sanitation",
    "Roads & Infrastructure",
    "Energy & Utilities",
    "Civil Supplies & Ration",
    "Revenue & Property",
    "Transport & Traffic",
    "Social Welfare & Pensions",
    "Public Health & Hospitals",
    "Environmental & Pollution",
    "General Public Administration"
]

ALLOWED_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
ALLOWED_UPLOAD_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}


def normalize_category(category: str) -> Optional[str]:
    cleaned = category.strip().lower()
    for allowed in GRIEVANCE_CATEGORIES:
        if allowed.lower() == cleaned:
            return allowed
    return None


def generate_reference_number() -> str:
    today_str = datetime.now().strftime("%Y%m%d")
    random_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"GRV-{today_str}-{random_suffix}"

@router.get("/categories", response_model=List[str])
def list_grievance_categories():
    return GRIEVANCE_CATEGORIES

@router.get("/summary", response_model=GrievanceSummaryResponse)
def get_my_grievance_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rows = db.execute(
        select(Grievance.current_status, func.count(Grievance.id))
        .where(Grievance.user_id == current_user.id)
        .group_by(Grievance.current_status)
    ).all()
    counts = {row[0]: row[1] for row in rows}
    return GrievanceSummaryResponse(
        total=sum(counts.values()),
        submitted=counts.get("Submitted", 0),
        under_review=counts.get("Under Review", 0),
        in_progress=counts.get("In Progress", 0),
        resolved=counts.get("Resolved", 0),
        rejected=counts.get("Rejected", 0),
    )

@router.post("/attachments", status_code=status.HTTP_201_CREATED)
async def upload_grievance_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(require_citizen),
):
    original_name = (file.filename or "").strip()
    suffix = Path(original_name).suffix.lower()

    if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported attachment type. Allowed formats: JPEG, PNG, PDF.",
        )
    if file.content_type not in ALLOWED_UPLOAD_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported attachment content type. Allowed formats: JPEG, PNG, PDF.",
        )

    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded attachment is empty.",
        )
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Attachment exceeds the maximum permitted size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    (upload_dir / stored_name).write_bytes(contents)

    return {
        "path": f"/uploads/{stored_name}",
        "original_filename": original_name,
        "size": len(contents),
    }

@router.post("", response_model=GrievanceResponse, status_code=status.HTTP_201_CREATED)
def submit_grievance(
    payload: GrievanceCreateRequest,
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db)
):
    category = normalize_category(payload.category)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid grievance category. Must be one of: {', '.join(GRIEVANCE_CATEGORIES)}",
        )

    ref_num = generate_reference_number()
    for _ in range(5):
        existing = db.scalar(select(Grievance).where(Grievance.reference_number == ref_num))
        if not existing:
            break
        ref_num = generate_reference_number()

    new_grievance = Grievance(
        user_id=current_user.id,
        reference_number=ref_num,
        subject=payload.subject.strip(),
        description=payload.description.strip(),
        category=category,
        location=payload.location.strip(),
        attachment_path=payload.attachment_path,
        current_status="Submitted"
    )
    db.add(new_grievance)
    db.flush()

    initial_history = GrievanceHistory(
        grievance_id=new_grievance.id,
        changed_by=current_user.id,
        old_status=None,
        new_status="Submitted",
        remarks="Grievance successfully lodged by citizen through portal."
    )
    db.add(initial_history)
    db.commit()
    db.refresh(new_grievance)

    res = GrievanceResponse.model_validate(new_grievance)
    res.citizen_name = current_user.full_name
    res.citizen_email = current_user.email
    return res

@router.get("", response_model=GrievanceListResponse)
def get_my_grievances(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = select(Grievance).where(Grievance.user_id == current_user.id)
    count_query = select(func.count(Grievance.id)).where(Grievance.user_id == current_user.id)

    filters = []
    if status_filter and status_filter.strip():
        filters.append(Grievance.current_status.ilike(status_filter.strip()))
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Grievance.reference_number.ilike(term),
                Grievance.subject.ilike(term),
                Grievance.category.ilike(term),
                Grievance.location.ilike(term)
            )
        )

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = db.scalar(count_query) or 0

    query = query.order_by(desc(Grievance.created_at)).offset((page - 1) * page_size).limit(page_size)
    grievances = db.scalars(query).all()

    items = []
    for g in grievances:
        resp_item = GrievanceResponse.model_validate(g)
        resp_item.citizen_name = current_user.full_name
        resp_item.citizen_email = current_user.email
        items.append(resp_item)

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return GrievanceListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/track/{reference_number}", response_model=GrievanceDetailResponse)
def track_grievance_by_ref(
    reference_number: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stmt = (
        select(Grievance)
        .options(selectinload(Grievance.history).selectinload(GrievanceHistory.changer), selectinload(Grievance.user))
        .where(Grievance.reference_number == reference_number.strip().upper())
    )
    grievance = db.scalar(stmt)

    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Grievance with reference number '{reference_number}' not found."
        )

    if current_user.role != "admin" and grievance.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this grievance record."
        )

    detail = GrievanceDetailResponse.model_validate(grievance)
    detail.citizen_name = grievance.user.full_name if grievance.user else None
    detail.citizen_email = grievance.user.email if grievance.user else None

    history_list = []
    for h in grievance.history:
        h_resp = GrievanceHistoryResponse.model_validate(h)
        h_resp.changed_by_name = h.changer.full_name if h.changer else "System / Citizen"
        history_list.append(h_resp)
    detail.history = history_list

    return detail

@router.get("/{grievance_id}", response_model=GrievanceDetailResponse)
def get_grievance_detail(
    grievance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stmt = (
        select(Grievance)
        .options(selectinload(Grievance.history).selectinload(GrievanceHistory.changer), selectinload(Grievance.user))
        .where(Grievance.id == grievance_id)
    )
    grievance = db.scalar(stmt)

    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance not found."
        )

    if current_user.role != "admin" and grievance.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view another citizen's grievance."
        )

    detail = GrievanceDetailResponse.model_validate(grievance)
    detail.citizen_name = grievance.user.full_name if grievance.user else None
    detail.citizen_email = grievance.user.email if grievance.user else None

    history_list = []
    for h in grievance.history:
        h_resp = GrievanceHistoryResponse.model_validate(h)
        h_resp.changed_by_name = h.changer.full_name if h.changer else "System / Citizen"
        history_list.append(h_resp)
    detail.history = history_list

    return detail

@router.get("/{grievance_id}/history", response_model=List[GrievanceHistoryResponse])
def get_grievance_history(
    grievance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    grievance = db.scalar(select(Grievance).where(Grievance.id == grievance_id))
    if not grievance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    if current_user.role != "admin" and grievance.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    history_stmt = (
        select(GrievanceHistory)
        .options(selectinload(GrievanceHistory.changer))
        .where(GrievanceHistory.grievance_id == grievance_id)
        .order_by(desc(GrievanceHistory.created_at))
    )
    records = db.scalars(history_stmt).all()

    history_list = []
    for h in records:
        h_resp = GrievanceHistoryResponse.model_validate(h)
        h_resp.changed_by_name = h.changer.full_name if h.changer else "System / Citizen"
        history_list.append(h_resp)

    return history_list
