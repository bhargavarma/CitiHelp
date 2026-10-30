"""Administrator dashboard, register and audit-trail tests.

These tests use the isolated SQLite database configured in ``conftest.py``.
They never touch the real Supabase database and never call Gemini.
"""

import os
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database.seed import seed_admin_user
from app.models.grievance import Grievance
from app.models.user import User

ADMIN_EMAIL = os.environ.get("ADMIN_BOOTSTRAP_EMAIL", "admin@grievance.gov.in")
ADMIN_PASSWORD = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD", "Admin@123456")
ADMIN_NAME = os.environ.get("ADMIN_BOOTSTRAP_NAME", "Chief Grievance Officer")

BASE_GRIEVANCE = {
    "subject": "Broken drainage cover near primary school",
    "description": "The drainage cover has been missing for four days, creating a safety hazard.",
    "category": "Water Supply & Sanitation",
    "location": "Ward 7, Near Primary School",
}


def unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}"


def admin_headers(client: TestClient) -> dict:
    response = client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def register_and_login(
    client: TestClient,
    email: str | None = None,
    full_name: str = "Admin Test Citizen",
    password: str = "Password@123",
) -> tuple[dict, str]:
    email = email or f"{unique('citizen')}@example.com"
    registered = client.post(
        "/auth/register",
        json={"email": email, "full_name": full_name, "password": password},
    )
    assert registered.status_code == 201, registered.text
    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, email


def create_grievance(client: TestClient, headers: dict, **overrides) -> dict:
    payload = dict(BASE_GRIEVANCE)
    payload.update(overrides)
    response = client.post("/grievances", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def set_status(client: TestClient, admin: dict, grievance_id: str, status: str, remarks: str) -> dict:
    response = client.patch(
        f"/admin/grievances/{grievance_id}/status",
        json={"status": status, "remarks": remarks},
        headers=admin,
    )
    assert response.status_code == 200, response.text
    return response.json()


# ---------------------------------------------------------------------------
# Authentication and authorization
# ---------------------------------------------------------------------------

def test_admin_login_succeeds_and_invalid_password_fails(client: TestClient):
    good = client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert good.status_code == 200
    assert good.json()["access_token"]

    bad = client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": "WrongPassword123"}
    )
    assert bad.status_code == 401


def test_admin_endpoints_require_authentication(client: TestClient):
    assert client.get("/admin/stats").status_code == 401
    assert client.get("/admin/analytics").status_code == 401
    assert client.get("/admin/grievances").status_code == 401
    assert client.get("/admin/grievances/unknown/history").status_code == 401


def test_citizen_cannot_access_admin_apis_or_update_status(client: TestClient):
    citizen, _ = register_and_login(client, full_name="Blocked Citizen")
    grievance = create_grievance(client, citizen)

    assert client.get("/admin/stats", headers=citizen).status_code == 403
    assert client.get("/admin/grievances", headers=citizen).status_code == 403
    assert client.get(f"/admin/grievances/{grievance['id']}", headers=citizen).status_code == 403
    assert (
        client.get(
            f"/admin/grievances/{grievance['id']}/history", headers=citizen
        ).status_code
        == 403
    )

    update = client.patch(
        f"/admin/grievances/{grievance['id']}/status",
        json={"status": "Resolved", "remarks": "Unauthorised attempt"},
        headers=citizen,
    )
    assert update.status_code == 403


def test_citizen_cannot_view_another_citizens_grievance(client: TestClient):
    owner, _ = register_and_login(client, full_name="Record Owner")
    other, _ = register_and_login(client, full_name="Other Citizen")
    grievance = create_grievance(client, owner)

    assert client.get(f"/grievances/{grievance['id']}", headers=other).status_code == 403
    assert (
        client.get(f"/grievances/{grievance['id']}/history", headers=other).status_code
        == 403
    )

    admin = admin_headers(client)
    assert client.get(f"/admin/grievances/{grievance['id']}", headers=admin).status_code == 200


def test_admin_bootstrap_preserves_existing_account_and_never_promotes_citizen(
    client: TestClient, db_session
):
    # Existing administrator: password and role are preserved.
    existing = seed_admin_user(db_session, ADMIN_EMAIL, "ReplacementPass123")
    assert existing is not None
    assert existing.role == "admin"
    assert client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    ).status_code == 200
    assert client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": "ReplacementPass123"}
    ).status_code == 401

    # Existing citizen: bootstrap must not escalate the account.
    _, citizen_email = register_and_login(client, full_name="Not An Admin")
    assert seed_admin_user(db_session, citizen_email, "AnotherPass123") is None
    db_session.expire_all()
    citizen = db_session.scalar(select(User).where(User.email == citizen_email))
    assert citizen is not None
    assert citizen.role == "citizen"
    assert client.post(
        "/auth/login", json={"email": citizen_email, "password": "Password@123"}
    ).status_code == 200


# ---------------------------------------------------------------------------
# Register: search, filters, sorting and pagination
# ---------------------------------------------------------------------------

def test_admin_sees_all_grievances_and_searches_by_citizen_name(client: TestClient):
    marker = uuid.uuid4().hex[:8]
    citizen_name = f"Nirmala Searchable {marker}"
    citizen, citizen_email = register_and_login(client, full_name=citizen_name)
    grievance = create_grievance(client, citizen, subject=f"Unique water issue {marker}")
    admin = admin_headers(client)

    all_records = client.get("/admin/grievances?page_size=50", headers=admin)
    assert all_records.status_code == 200
    assert any(item["id"] == grievance["id"] for item in all_records.json()["items"])

    by_name = client.get(f"/admin/grievances?search={marker}", headers=admin)
    assert by_name.status_code == 200
    assert by_name.json()["total"] == 1
    assert by_name.json()["items"][0]["citizen_name"] == citizen_name
    assert by_name.json()["items"][0]["citizen_email"] == citizen_email

    by_email = client.get(f"/admin/grievances?search={citizen_email}", headers=admin)
    assert by_email.status_code == 200
    assert by_email.json()["total"] == 1

    by_category = client.get(
        "/admin/grievances?category=Water%20Supply%20%26%20Sanitation&search=" + marker,
        headers=admin,
    )
    assert by_category.status_code == 200
    assert by_category.json()["total"] == 1


def test_admin_status_group_filter_and_status_sort(client: TestClient):
    marker = uuid.uuid4().hex[:8]
    citizen, _ = register_and_login(client, full_name=f"Queue Citizen {marker}")
    pending = create_grievance(client, citizen, subject=f"Pending item {marker}")
    resolved = create_grievance(client, citizen, subject=f"Resolved item {marker}")
    rejected = create_grievance(client, citizen, subject=f"Rejected item {marker}")
    admin = admin_headers(client)

    set_status(client, admin, pending["id"], "Under Review", "Assigned to field officer.")
    set_status(client, admin, resolved["id"], "Resolved", "Work completed.")
    set_status(client, admin, rejected["id"], "Rejected", "Outside municipal jurisdiction.")

    pending_queue = client.get(
        "/admin/grievances?status=Submitted,Under%20Review,In%20Progress&search=" + marker,
        headers=admin,
    )
    assert pending_queue.status_code == 200
    assert pending_queue.json()["total"] == 1
    assert pending_queue.json()["items"][0]["id"] == pending["id"]

    resolved_queue = client.get(
        "/admin/grievances?status=Resolved&search=" + marker, headers=admin
    )
    assert resolved_queue.status_code == 200
    assert resolved_queue.json()["total"] == 1
    assert resolved_queue.json()["items"][0]["id"] == resolved["id"]

    sorted_records = client.get(
        "/admin/grievances?search=" + marker + "&sort=status&page_size=10",
        headers=admin,
    )
    assert sorted_records.status_code == 200
    rank = {
        "Submitted": 1,
        "Under Review": 2,
        "In Progress": 3,
        "Resolved": 4,
        "Rejected": 5,
    }
    statuses = [item["current_status"] for item in sorted_records.json()["items"]]
    assert [rank[status] for status in statuses] == sorted(
        rank[status] for status in statuses
    )

    invalid_status = client.get("/admin/grievances?status=NotAStatus", headers=admin)
    assert invalid_status.status_code == 400

    invalid_sort = client.get("/admin/grievances?sort=random", headers=admin)
    assert invalid_sort.status_code == 422


def test_admin_date_filter_and_pagination(client: TestClient):
    marker = uuid.uuid4().hex[:8]
    citizen, _ = register_and_login(client, full_name=f"Paging Citizen {marker}")
    for index in range(3):
        create_grievance(client, citizen, subject=f"Date filter item {marker} {index}")
    admin = admin_headers(client)

    page_one = client.get(
        f"/admin/grievances?search={marker}&page=1&page_size=2", headers=admin
    )
    assert page_one.status_code == 200
    first = page_one.json()
    assert first["total"] == 3
    assert len(first["items"]) == 2
    assert first["total_pages"] == 2

    page_two = client.get(
        f"/admin/grievances?search={marker}&page=2&page_size=2", headers=admin
    )
    assert page_two.status_code == 200
    assert len(page_two.json()["items"]) == 1

    wide_range = client.get(
        f"/admin/grievances?search={marker}&date_from=2000-01-01&date_to=2100-01-01",
        headers=admin,
    )
    assert wide_range.status_code == 200
    assert wide_range.json()["total"] == 3

    future_range = client.get(
        f"/admin/grievances?search={marker}&date_from=2100-01-02", headers=admin
    )
    assert future_range.status_code == 200
    assert future_range.json()["total"] == 0

    invalid_range = client.get(
        f"/admin/grievances?search={marker}&date_from=2100-01-02&date_to=2000-01-01",
        headers=admin,
    )
    assert invalid_range.status_code == 400


def test_admin_register_handles_missing_records_and_empty_search(client: TestClient):
    admin = admin_headers(client)
    missing = client.get("/admin/grievances/does-not-exist", headers=admin)
    assert missing.status_code == 404
    missing_history = client.get(
        "/admin/grievances/does-not-exist/history", headers=admin
    )
    assert missing_history.status_code == 404

    empty = client.get(
        f"/admin/grievances?search=no-such-{uuid.uuid4().hex}", headers=admin
    )
    assert empty.status_code == 200
    assert empty.json()["items"] == []
    assert empty.json()["total"] == 0
    assert empty.json()["total_pages"] == 0


# ---------------------------------------------------------------------------
# Status updates and immutable audit trail
# ---------------------------------------------------------------------------

def test_status_update_creates_history_and_preserves_previous_records(client: TestClient):
    citizen, _ = register_and_login(client, full_name="Audit Trail Citizen")
    grievance = create_grievance(client, citizen)
    admin = admin_headers(client)

    first = set_status(
        client, admin, grievance["id"], "Under Review", "Assigned to junior engineer."
    )
    assert first["current_status"] == "Under Review"
    assert len(first["history"]) == 2

    second = set_status(
        client, admin, grievance["id"], "In Progress", "Repair work started on site."
    )
    assert second["current_status"] == "In Progress"
    assert len(second["history"]) == 3

    history = second["history"]
    submitted = next(item for item in history if item["new_status"] == "Submitted")
    under_review = next(item for item in history if item["new_status"] == "Under Review")
    in_progress = next(item for item in history if item["new_status"] == "In Progress")

    # Earlier records are unchanged.
    assert submitted["remarks"] == "Grievance successfully lodged by citizen through portal."
    assert under_review["remarks"] == "Assigned to junior engineer."
    assert under_review["old_status"] == "Submitted"

    # The new record identifies the administrator and the transition.
    assert in_progress["old_status"] == "Under Review"
    assert in_progress["remarks"] == "Repair work started on site."
    assert in_progress["changed_by_name"] == ADMIN_NAME

    admin_history = client.get(
        f"/admin/grievances/{grievance['id']}/history", headers=admin
    )
    assert admin_history.status_code == 200
    records = admin_history.json()
    assert len(records) == 3
    assert {record["new_status"] for record in records} == {
        "Submitted",
        "Under Review",
        "In Progress",
    }
    assert records[-1]["changed_by_name"] == ADMIN_NAME

    citizen_view = client.get(f"/grievances/{grievance['id']}", headers=citizen)
    assert citizen_view.status_code == 200
    assert citizen_view.json()["current_status"] == "In Progress"
    assert len(citizen_view.json()["history"]) == 3


def test_invalid_status_update_is_rejected_without_creating_history(client: TestClient):
    citizen, _ = register_and_login(client, full_name="Invalid Status Citizen")
    grievance = create_grievance(client, citizen)
    admin = admin_headers(client)

    response = client.patch(
        f"/admin/grievances/{grievance['id']}/status",
        json={"status": "Escalated", "remarks": "Not a supported status."},
        headers=admin,
    )
    assert response.status_code == 400
    assert "invalid status" in response.json()["detail"].lower()

    history = client.get(
        f"/admin/grievances/{grievance['id']}/history", headers=admin
    ).json()
    assert len(history) == 1
    assert history[0]["new_status"] == "Submitted"


def test_status_update_on_missing_grievance_returns_404(client: TestClient):
    admin = admin_headers(client)
    response = client.patch(
        "/admin/grievances/missing-id/status",
        json={"status": "Resolved", "remarks": "Nothing to update."},
        headers=admin,
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Dashboard statistics
# ---------------------------------------------------------------------------

def test_dashboard_statistics_match_database_records(client: TestClient, db_session):
    marker = uuid.uuid4().hex[:8]
    citizen, _ = register_and_login(client, full_name=f"Stats Citizen {marker}")
    submitted = create_grievance(client, citizen, subject=f"Stats submitted {marker}")
    resolved = create_grievance(client, citizen, subject=f"Stats resolved {marker}")
    rejected = create_grievance(client, citizen, subject=f"Stats rejected {marker}")
    admin = admin_headers(client)

    set_status(client, admin, resolved["id"], "Resolved", "Resolved for stats test.")
    set_status(client, admin, rejected["id"], "Rejected", "Rejected for stats test.")

    response = client.get("/admin/stats", headers=admin)
    assert response.status_code == 200
    stats = response.json()

    total = db_session.scalar(select(func.count(Grievance.id))) or 0
    rows = db_session.execute(
        select(Grievance.current_status, func.count(Grievance.id)).group_by(
            Grievance.current_status
        )
    ).all()
    status_counts = {row[0]: row[1] for row in rows}
    category_rows = db_session.execute(
        select(Grievance.category, func.count(Grievance.id)).group_by(Grievance.category)
    ).all()
    category_counts = {row[0]: row[1] for row in category_rows}

    assert stats["total_grievances"] == total
    assert stats["submitted"] == status_counts.get("Submitted", 0)
    assert stats["under_review"] == status_counts.get("Under Review", 0)
    assert stats["in_progress"] == status_counts.get("In Progress", 0)
    assert stats["resolved"] == status_counts.get("Resolved", 0)
    assert stats["rejected"] == status_counts.get("Rejected", 0)
    assert stats["pending"] == (
        status_counts.get("Submitted", 0)
        + status_counts.get("Under Review", 0)
        + status_counts.get("In Progress", 0)
    )

    returned_categories = {
        item["category"]: item["count"] for item in stats["category_distribution"]
    }
    assert returned_categories == category_counts

    assert len(stats["recent_grievances"]) <= 5
    assert len(stats["recent_updates"]) <= 5
    assert any(
        update["reference_number"] == rejected["reference_number"]
        for update in stats["recent_updates"]
    )
    assert any(
        item["id"] in {submitted["id"], resolved["id"], rejected["id"]}
        for item in stats["recent_grievances"]
    )

    analytics = client.get("/admin/analytics", headers=admin)
    assert analytics.status_code == 200
    assert analytics.json()["total_grievances"] == stats["total_grievances"]
    assert analytics.json()["pending"] == stats["pending"]


def test_dashboard_empty_register_is_handled(client: TestClient):
    admin = admin_headers(client)
    response = client.get(
        f"/admin/grievances?search=empty-{uuid.uuid4().hex}", headers=admin
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 0
    assert payload["total_pages"] == 0
    assert payload["items"] == []
