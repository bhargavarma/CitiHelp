import pytest
from fastapi.testclient import TestClient

def test_01_citizen_registration(client: TestClient):
    payload = {
        "email": "citizen.test@example.com",
        "full_name": "Ravi Teja",
        "phone": "9876543210",
        "password": "Password@123"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "citizen.test@example.com"
    assert data["role"] == "citizen"
    assert "password" not in data
    assert "password_hash" not in data

def test_02_duplicate_email_rejection(client: TestClient):
    payload = {
        "email": "duplicate.test@example.com",
        "full_name": "Suresh Kumar",
        "password": "Password@123"
    }
    res1 = client.post("/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"].lower()

def test_03_successful_login(client: TestClient):
    reg_payload = {
        "email": "login.user@example.com",
        "full_name": "Priya Sharma",
        "password": "MyStrongPassword@1"
    }
    client.post("/auth/register", json=reg_payload)

    login_payload = {
        "email": "login.user@example.com",
        "password": "MyStrongPassword@1"
    }
    response = client.post("/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"].lower() == "bearer"

def test_04_invalid_password(client: TestClient):
    reg_payload = {
        "email": "pass.check@example.com",
        "full_name": "Anita Roy",
        "password": "CorrectPassword@1"
    }
    client.post("/auth/register", json=reg_payload)

    login_payload = {
        "email": "pass.check@example.com",
        "password": "WrongPassword@999"
    }
    response = client.post("/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "invalid email or password" in response.json()["detail"].lower()

def test_05_access_protected_api_without_auth(client: TestClient):
    response = client.get("/auth/me")
    assert response.status_code == 401

def test_06_invalid_or_expired_jwt(client: TestClient):
    bad_headers = {"Authorization": "Bearer definitely.an.invalid.jwt.token"}
    response = client.get("/auth/me", headers=bad_headers)
    assert response.status_code == 401

def test_07_citizen_access_own_grievance(client: TestClient):
    client.post("/auth/register", json={
        "email": "citizen.owner@example.com",
        "full_name": "Rohan Verma",
        "password": "Password@123"
    })
    login_res = client.post("/auth/login", json={
        "email": "citizen.owner@example.com",
        "password": "Password@123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    grv_payload = {
        "subject": "Contaminated drinking water in Colony B",
        "description": "The tap water has been yellowish and muddy since yesterday morning.",
        "category": "Water Supply & Sanitation",
        "location": "Sector 4, Street 12"
    }
    sub_res = client.post("/grievances", json=grv_payload, headers=headers)
    assert sub_res.status_code == 201
    grievance_id = sub_res.json()["id"]
    ref_num = sub_res.json()["reference_number"]

    get_res = client.get(f"/grievances/{grievance_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == grievance_id
    assert get_res.json()["reference_number"] == ref_num

def test_08_citizen_cannot_access_another_citizens_grievance(client: TestClient):
    client.post("/auth/register", json={
        "email": "citizen.a@example.com",
        "full_name": "Citizen A",
        "password": "Password@123"
    })
    tok_a = client.post("/auth/login", json={"email": "citizen.a@example.com", "password": "Password@123"}).json()["access_token"]
    headers_a = {"Authorization": f"Bearer {tok_a}"}

    client.post("/auth/register", json={
        "email": "citizen.b@example.com",
        "full_name": "Citizen B",
        "password": "Password@123"
    })
    tok_b = client.post("/auth/login", json={"email": "citizen.b@example.com", "password": "Password@123"}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {tok_b}"}

    sub_res = client.post("/grievances", json={
        "subject": "Street light damaged on Main Cross",
        "description": "High mast street light has burned out lamp fixture.",
        "category": "Roads & Infrastructure",
        "location": "Main Cross Road"
    }, headers=headers_a)
    grv_a_id = sub_res.json()["id"]
    grv_a_ref = sub_res.json()["reference_number"]

    res_id = client.get(f"/grievances/{grv_a_id}", headers=headers_b)
    assert res_id.status_code == 403

    res_track = client.get(f"/grievances/track/{grv_a_ref}", headers=headers_b)
    assert res_track.status_code == 403

def test_09_admin_only_access(client: TestClient):
    client.post("/auth/register", json={
        "email": "regular.citizen@example.com",
        "full_name": "Regular Guy",
        "password": "Password@123"
    })
    tok = client.post("/auth/login", json={"email": "regular.citizen@example.com", "password": "Password@123"}).json()["access_token"]
    citizen_headers = {"Authorization": f"Bearer {tok}"}

    res = client.get("/admin/stats", headers=citizen_headers)
    assert res.status_code == 403
    assert "administrative privileges required" in res.json()["detail"].lower()

    admin_login = client.post("/auth/login", json={
        "email": "admin@grievance.gov.in",
        "password": "Admin@123456"
    })
    assert admin_login.status_code == 200
    admin_tok = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_tok}"}

    admin_res = client.get("/admin/stats", headers=admin_headers)
    assert admin_res.status_code == 200
    assert "total_grievances" in admin_res.json()

def test_10_grievance_submission(client: TestClient):
    client.post("/auth/register", json={
        "email": "sub.test@example.com",
        "full_name": "Kavita Rao",
        "password": "Password@123"
    })
    tok = client.post("/auth/login", json={"email": "sub.test@example.com", "password": "Password@123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}

    payload = {
        "subject": "Overflowing garbage dump in ward 9",
        "description": "Garbage has not been collected for three days near the municipal school.",
        "category": "Water Supply & Sanitation",
        "location": "Ward 9 Community Center"
    }
    response = client.post("/grievances", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["reference_number"].startswith("GRV-")
    assert data["current_status"] == "Submitted"
    assert data["subject"] == payload["subject"]

def test_11_invalid_grievance_input(client: TestClient):
    client.post("/auth/register", json={
        "email": "inv.test@example.com",
        "full_name": "Arun Kumar",
        "password": "Password@123"
    })
    tok = client.post("/auth/login", json={"email": "inv.test@example.com", "password": "Password@123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}

    bad_payload = {
        "subject": "Bad",
        "description": "Too short",
        "category": "Misc",
        "location": "Loc"
    }
    response = client.post("/grievances", json=bad_payload, headers=headers)
    assert response.status_code == 422

def test_12_and_13_grievance_status_update_and_history_persistence(client: TestClient):
    client.post("/auth/register", json={
        "email": "status.test@example.com",
        "full_name": "Sunita Patil",
        "password": "Password@123"
    })
    tok_cit = client.post("/auth/login", json={"email": "status.test@example.com", "password": "Password@123"}).json()["access_token"]
    headers_cit = {"Authorization": f"Bearer {tok_cit}"}

    sub_res = client.post("/grievances", json={
        "subject": "Low water pressure in municipal pipeline",
        "description": "Pipeline pressure has decreased drastically across residential block 3.",
        "category": "Water Supply & Sanitation",
        "location": "Block 3, Colony Lane"
    }, headers=headers_cit)
    grv_id = sub_res.json()["id"]

    admin_login = client.post("/auth/login", json={
        "email": "admin@grievance.gov.in",
        "password": "Admin@123456"
    })
    tok_adm = admin_login.json()["access_token"]
    headers_adm = {"Authorization": f"Bearer {tok_adm}"}

    patch_res = client.patch(
        f"/admin/grievances/{grv_id}/status",
        json={"status": "Under Review", "remarks": "Assigned to Junior Engineer for hydraulic test."},
        headers=headers_adm
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["current_status"] == "Under Review"

    patch_res2 = client.patch(
        f"/admin/grievances/{grv_id}/status",
        json={"status": "In Progress", "remarks": "Main booster valve repair underway."},
        headers=headers_adm
    )
    assert patch_res2.status_code == 200
    assert patch_res2.json()["current_status"] == "In Progress"

    hist_res = client.get(f"/grievances/{grv_id}/history", headers=headers_cit)
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) == 3
    statuses = [h["new_status"] for h in history]
    assert "In Progress" in statuses
    assert "Under Review" in statuses
    assert "Submitted" in statuses

def test_14_service_directory_retrieval(client: TestClient):
    response = client.get("/services")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 15
    assert len(data["items"]) > 0
    first = data["items"][0]
    assert "name" in first
    assert "category" in first
    assert "procedure" in first
    assert "required_documents" in first

def test_15_service_search(client: TestClient):
    response = client.get("/services?search=Birth")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("birth" in s["name"].lower() for s in data["items"])

def test_16_ai_handling_of_unsupported_questions(client: TestClient):
    client.post("/auth/register", json={
        "email": "ai.test@example.com",
        "full_name": "Geeta Roy",
        "password": "Password@123"
    })
    tok = client.post("/auth/login", json={"email": "ai.test@example.com", "password": "Password@123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}

    unsupported_query = {
        "message": "Quantum teleportation intergalactic spaceship propulsion warp drive manual"
    }
    response = client.post("/chat", json=unsupported_query, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "assistant"
    assert "do not have verified" in data["content"].lower() or "not have" in data["content"].lower()
    assert len(data["sources"]) == 0
