import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

ADMIN_EMAIL = os.environ.get("ADMIN_BOOTSTRAP_EMAIL", "admin@grievance.gov.in")
ADMIN_PASSWORD = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD", "Admin@123456")

DEFAULT_GRIEVANCE = {
    "subject": "Broken drainage cover near primary school",
    "description": "The drainage cover has been missing for four days, creating a safety hazard.",
    "category": "Water Supply & Sanitation",
    "location": "Ward 7, Near Primary School",
}


def register_and_login(
    client: TestClient,
    email: str,
    password: str = "Password@123",
    full_name: str = "Extended Test Citizen",
) -> dict:
    response = client.post(
        "/auth/register",
        json={"email": email, "full_name": full_name, "password": password},
    )
    assert response.status_code == 201, response.text

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def admin_headers(client: TestClient) -> dict:
    login = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_grievance(client: TestClient, headers: dict, **overrides) -> dict:
    payload = dict(DEFAULT_GRIEVANCE)
    payload.update(overrides)
    response = client.post("/grievances", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------------------
# Registration / authentication edge cases
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "password",
    ["short1", "onlyletters", "12345678", "Ab1"],
)
def test_weak_passwords_are_rejected(client: TestClient, password: str):
    response = client.post(
        "/auth/register",
        json={
            "email": f"weak.{password}@example.com",
            "full_name": "Weak Password",
            "password": password,
        },
    )
    assert response.status_code == 422


def test_public_registration_cannot_create_admin(client: TestClient):
    response = client.post(
        "/auth/register",
        json={
            "email": "sneaky.admin@example.com",
            "full_name": "Sneaky Admin",
            "password": "Password@123",
            "role": "admin",
        },
    )
    assert response.status_code == 201
    assert response.json()["role"] == "citizen"

    login = client.post(
        "/auth/login",
        json={"email": "sneaky.admin@example.com", "password": "Password@123"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/admin/stats", headers=headers).status_code == 403


def test_duplicate_email_is_case_insensitive(client: TestClient):
    first = client.post(
        "/auth/register",
        json={
            "email": "Case.User@Example.com",
            "full_name": "Case User",
            "password": "Password@123",
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/auth/register",
        json={
            "email": "case.user@example.com",
            "full_name": "Case User Duplicate",
            "password": "Password@123",
        },
    )
    assert second.status_code == 409


def test_protected_endpoints_require_authentication(client: TestClient):
    assert client.get("/grievances/summary").status_code == 401
    assert client.get("/grievances").status_code == 401
    assert client.get("/chat/sessions").status_code == 401
    assert client.get("/admin/stats").status_code == 401


def test_admin_cannot_submit_citizen_grievance(client: TestClient):
    response = client.post("/grievances", json=DEFAULT_GRIEVANCE, headers=admin_headers(client))
    assert response.status_code == 403
    assert "citizen privileges required" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Grievance lifecycle
# ---------------------------------------------------------------------------

def test_grievance_summary_uses_real_database_counts(client: TestClient):
    headers = register_and_login(client, "summary.user@example.com")
    first = create_grievance(client, headers)
    create_grievance(client, headers, subject="Second grievance about street lighting")

    admin = admin_headers(client)
    update = client.patch(
        f"/admin/grievances/{first['id']}/status",
        json={"status": "Resolved", "remarks": "Drainage cover replaced by field team."},
        headers=admin,
    )
    assert update.status_code == 200

    summary = client.get("/grievances/summary", headers=headers)
    assert summary.status_code == 200
    data = summary.json()
    assert data["total"] == 2
    assert data["submitted"] == 1
    assert data["resolved"] == 1


def test_tracking_by_reference_and_initial_history(client: TestClient):
    headers = register_and_login(client, "tracking.user@example.com")
    grievance = create_grievance(client, headers)

    tracked = client.get(f"/grievances/track/{grievance['reference_number']}", headers=headers)
    assert tracked.status_code == 200
    assert tracked.json()["id"] == grievance["id"]

    history = client.get(f"/grievances/{grievance['id']}/history", headers=headers)
    assert history.status_code == 200
    records = history.json()
    assert len(records) == 1
    assert records[0]["new_status"] == "Submitted"


def test_invalid_category_is_rejected(client: TestClient):
    headers = register_and_login(client, "category.user@example.com")
    response = client.post(
        "/grievances",
        json={**DEFAULT_GRIEVANCE, "category": "Intergalactic Affairs"},
        headers=headers,
    )
    assert response.status_code == 400
    assert "invalid grievance category" in response.json()["detail"].lower()


def test_grievance_list_search_and_pagination(client: TestClient):
    headers = register_and_login(client, "paging.user@example.com")
    create_grievance(client, headers, subject="Water leakage on First Avenue")
    create_grievance(client, headers, subject="Water leakage on Second Avenue")
    create_grievance(client, headers, subject="Street light failure on Third Avenue")

    page_one = client.get("/grievances?page=1&page_size=2", headers=headers)
    assert page_one.status_code == 200
    data = page_one.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["total_pages"] == 2

    searched = client.get("/grievances?search=Second", headers=headers)
    assert searched.status_code == 200
    assert searched.json()["total"] == 1
    assert "Second" in searched.json()["items"][0]["subject"]


def test_status_history_preserves_every_update(client: TestClient):
    headers = register_and_login(client, "history.user@example.com")
    grievance = create_grievance(client, headers)
    admin = admin_headers(client)

    transitions = [
        ("Under Review", "Assigned to junior engineer."),
        ("In Progress", "Repair work started."),
        ("Resolved", "Repair completed and verified."),
    ]
    for new_status, remarks in transitions:
        response = client.patch(
            f"/admin/grievances/{grievance['id']}/status",
            json={"status": new_status, "remarks": remarks},
            headers=admin,
        )
        assert response.status_code == 200
        assert response.json()["current_status"] == new_status

    history = client.get(f"/grievances/{grievance['id']}/history", headers=headers).json()
    assert len(history) == 4
    assert {record["new_status"] for record in history} == {
        "Submitted",
        "Under Review",
        "In Progress",
        "Resolved",
    }
    resolved_record = next(record for record in history if record["new_status"] == "Resolved")
    assert resolved_record["old_status"] == "In Progress"
    assert "Repair completed" in resolved_record["remarks"]


def test_invalid_status_is_rejected(client: TestClient):
    headers = register_and_login(client, "badstatus.user@example.com")
    grievance = create_grievance(client, headers)
    admin = admin_headers(client)

    response = client.patch(
        f"/admin/grievances/{grievance['id']}/status",
        json={"status": "Closed Forever", "remarks": "Not a valid status."},
        headers=admin,
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Attachments
# ---------------------------------------------------------------------------

def test_attachment_upload_and_link_to_grievance(client: TestClient):
    headers = register_and_login(client, "attachment.user@example.com")

    upload = client.post(
        "/grievances/attachments",
        files={"file": ("proof.png", b"\x89PNG\r\n\x1a\nfake-image-bytes", "image/png")},
        headers=headers,
    )
    assert upload.status_code == 201, upload.text
    uploaded = upload.json()
    assert uploaded["path"].startswith("/uploads/")
    assert uploaded["size"] > 0

    grievance = create_grievance(client, headers, attachment_path=uploaded["path"])
    assert grievance["attachment_path"] == uploaded["path"]

    served = client.get(f"http://testserver{uploaded['path']}")
    assert served.status_code == 200
    assert served.content == b"\x89PNG\r\n\x1a\nfake-image-bytes"


def test_attachment_rejects_invalid_extension(client: TestClient):
    headers = register_and_login(client, "badfile.user@example.com")
    response = client.post(
        "/grievances/attachments",
        files={"file": ("notes.txt", b"plain text", "text/plain")},
        headers=headers,
    )
    assert response.status_code == 400


def test_attachment_rejects_empty_file(client: TestClient):
    headers = register_and_login(client, "emptyfile.user@example.com")
    response = client.post(
        "/grievances/attachments",
        files={"file": ("empty.png", b"", "image/png")},
        headers=headers,
    )
    assert response.status_code == 400


def test_attachment_path_must_be_upload_path(client: TestClient):
    headers = register_and_login(client, "pathcheck.user@example.com")
    response = client.post(
        "/grievances",
        json={**DEFAULT_GRIEVANCE, "attachment_path": "../../etc/passwd"},
        headers=headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Services / admin authorization
# ---------------------------------------------------------------------------

def test_service_detail_and_categories(client: TestClient):
    listing = client.get("/services?page_size=50")
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert len(items) >= 15

    detail = client.get(f"/services/{items[0]['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == items[0]["id"]

    categories = client.get("/services/categories")
    assert categories.status_code == 200
    assert len(categories.json()["categories"]) >= 5

    missing = client.get("/services/00000000-0000-0000-0000-000000000000")
    assert missing.status_code == 404


def test_citizen_cannot_use_admin_endpoints(client: TestClient):
    headers = register_and_login(client, "no-admin.user@example.com")
    assert client.get("/admin/stats", headers=headers).status_code == 403
    assert client.get("/admin/grievances", headers=headers).status_code == 403
    assert client.get("/admin/analytics", headers=headers).status_code == 403


def test_admin_can_filter_search_and_view_any_grievance(client: TestClient):
    headers = register_and_login(client, "filter.user@example.com")
    grievance = create_grievance(
        client,
        headers,
        subject="Unique filterable subject about water tanker delay",
        category="Water Supply & Sanitation",
    )
    admin = admin_headers(client)

    by_search = client.get("/admin/grievances?search=filterable", headers=admin)
    assert by_search.status_code == 200
    assert any(item["id"] == grievance["id"] for item in by_search.json()["items"])

    by_status = client.get("/admin/grievances?status=Submitted", headers=admin)
    assert by_status.status_code == 200
    assert by_status.json()["total"] >= 1

    by_category = client.get(
        "/admin/grievances?category=Water%20Supply%20%26%20Sanitation",
        headers=admin,
    )
    assert by_category.status_code == 200
    assert by_category.json()["total"] >= 1

    detail = client.get(f"/admin/grievances/{grievance['id']}", headers=admin)
    assert detail.status_code == 200
    assert detail.json()["citizen_email"] == "filter.user@example.com"

    stats = client.get("/admin/stats", headers=admin)
    assert stats.status_code == 200
    payload = stats.json()
    for key in (
        "total_grievances",
        "submitted",
        "under_review",
        "in_progress",
        "resolved",
        "rejected",
        "category_distribution",
    ):
        assert key in payload
    assert payload["total_grievances"] >= 1

    analytics = client.get("/admin/analytics", headers=admin)
    assert analytics.status_code == 200
    assert analytics.json()["total_grievances"] == payload["total_grievances"]


# ---------------------------------------------------------------------------
# AI assistant
# ---------------------------------------------------------------------------

def test_chat_session_is_private_to_owner(client: TestClient):
    owner = register_and_login(client, "chat.owner@example.com")
    other = register_and_login(client, "chat.other@example.com")

    session = client.post("/chat/sessions", json={"title": "Ownership test"}, headers=owner)
    assert session.status_code == 201
    session_id = session.json()["id"]

    assert client.get(f"/chat/sessions/{session_id}/messages", headers=other).status_code == 403
    assert (
        client.post(
            f"/chat/sessions/{session_id}/messages",
            json={"message": "Can I read someone else's chat?"},
            headers=other,
        ).status_code
        == 403
    )


def test_supported_question_returns_grounded_sources(client: TestClient):
    headers = register_and_login(client, "chat.supported@example.com")
    session = client.post("/chat/sessions", json={"title": "Birth certificate"}, headers=headers)
    session_id = session.json()["id"]

    response = client.post(
        f"/chat/sessions/{session_id}/messages",
        json={"message": "What documents are needed for a Birth Certificate?"},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "assistant"
    assert data["content"]
    assert len(data["sources"]) >= 1
    for source in data["sources"]:
        assert source["title"]
        assert "last_reviewed" in source


def test_mocked_gemini_is_used_when_configured(client: TestClient, monkeypatch):
    import google.generativeai as genai

    captured = {}

    class FakeResponse:
        text = "Mocked Gemini grounded answer."

    class FakeModel:
        def __init__(self, model_name: str):
            captured["model"] = model_name

        def generate_content(self, prompt: str):
            captured["prompt"] = prompt
            return FakeResponse()

    monkeypatch.setattr(genai, "configure", lambda **kwargs: None)
    monkeypatch.setattr(genai, "GenerativeModel", FakeModel)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-mocked-key")

    headers = register_and_login(client, "chat.gemini@example.com")
    session = client.post("/chat/sessions", json={"title": "Gemini mock"}, headers=headers)
    response = client.post(
        f"/chat/sessions/{session.json()['id']}/messages",
        json={"message": "What documents are needed for a Birth Certificate?"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["content"] == "Mocked Gemini grounded answer."
    assert captured["model"] == settings.GEMINI_MODEL
    assert "VERIFIED SOURCES" in captured["prompt"]
    assert len(response.json()["sources"]) >= 1


@pytest.mark.skipif(
    os.environ.get("RUN_REAL_GEMINI_TESTS") != "1",
    reason="Set RUN_REAL_GEMINI_TESTS=1 and a real GEMINI_API_KEY to run this integration test.",
)
def test_real_gemini_integration(client: TestClient):
    """Opt-in integration test that calls the real Gemini API."""
    headers = register_and_login(client, "chat.real.gemini@example.com")
    session = client.post("/chat/sessions", json={"title": "Real Gemini"}, headers=headers)
    response = client.post(
        f"/chat/sessions/{session.json()['id']}/messages",
        json={"message": "What documents are needed for a Birth Certificate?"},
        headers=headers,
    )
    assert response.status_code == 200
    content = response.json()["content"]
    assert content
    # The deterministic fallback also returns content, so assert it was not used.
    assert "Configure GEMINI_API_KEY" not in content, (
        "Gemini call failed and the deterministic fallback was returned: " + content[:200]
    )
    assert len(response.json()["sources"]) >= 1


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
