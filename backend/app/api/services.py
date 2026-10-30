import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.service import Service
from app.schemas.service import (
    ServiceResponse,
    ServiceListResponse,
    ServiceCategoriesResponse
)

router = APIRouter(prefix="/services", tags=["Public Service Directory"])

@router.get("", response_model=ServiceListResponse)
def list_services(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    search: Optional[str] = Query(None, description="Search keyword in name or description"),
    category: Optional[str] = Query(None, description="Filter by service category"),
    db: Session = Depends(get_db)
):
    query = select(Service)
    count_query = select(func.count(Service.id))

    filters = []
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Service.name.ilike(term),
                Service.description.ilike(term),
                Service.department.ilike(term)
            )
        )
    if category and category.strip():
        filters.append(Service.category == category.strip())

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = db.scalar(count_query) or 0

    query = query.order_by(Service.name.asc()).offset((page - 1) * page_size).limit(page_size)
    items = db.scalars(query).all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return ServiceListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/categories", response_model=ServiceCategoriesResponse)
def get_categories(db: Session = Depends(get_db)):
    result = db.scalars(
        select(Service.category).distinct().order_by(Service.category.asc())
    ).all()
    categories = [cat for cat in result if cat]
    return ServiceCategoriesResponse(categories=categories)

@router.get("/{service_id}", response_model=ServiceResponse)
def get_service_detail(
    service_id: str,
    db: Session = Depends(get_db)
):
    svc = db.scalar(select(Service).where(Service.id == service_id))
    if not svc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public service not found"
        )
    return svc
