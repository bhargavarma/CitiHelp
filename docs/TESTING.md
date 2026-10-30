# TESTING — Public Grievance AI Assistant

> **Project ID:** HACK-P438
> **Last Updated:** 2026-10-31
> **Backend result:** `54 passed, 1 skipped`
> **Frontend result:** `npm run build` succeeds

---

## 1. Test Stack

| Layer | Tooling |
|-------|---------|
| Test runner | Pytest |
| HTTP client | FastAPI `TestClient` (HTTPX under the hood) |
| Database | Isolated SQLite file created per test session |
| Gemini | Mocked by default; real call is opt-in |
| Frontend | TypeScript compiler + Vite production build |

The backend test suite lives in `backend/tests/`:

- `conftest.py` — environment setup, isolated DB, seed data, fixtures
- `test_api.py` — core happy-path and authorization tests
- `test_extended.py` — edge cases, uploads, admin analytics, AI grounding
- `test_admin_dashboard.py` — admin authentication, authorization, bootstrap
  safety, register search/filters/sort/pagination, detail/history, status
  updates and dashboard statistics

---

## 2. Running the Backend Tests

From the repository root:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

macOS/Linux:

```bash
cd backend
.venv/bin/python -m pytest -q
```

Useful variants:

```powershell
# Verbose test names
.\.venv\Scripts\python.exe -m pytest -v

# One file
.\.venv\Scripts\python.exe -m pytest tests/test_extended.py -v

# Admin dashboard / grievance management suite
.\.venv\Scripts\python.exe -m pytest tests/test_admin_dashboard.py -q

# One test
.\.venv\Scripts\python.exe -m pytest tests/test_api.py::test_04_invalid_password -v

# Opt-in real Gemini integration test
$env:RUN_REAL_GEMINI_TESTS = "1"
$env:GEMINI_API_KEY = "<real-key>"
.\.venv\Scripts\python.exe -m pytest tests/test_extended.py::test_real_gemini_integration -v
```

> On Windows, pytest may print warnings to stderr and PowerShell may surface a
> non-zero shell exit code even when the summary line reports all tests passed.
> Trust the `passed`/`failed` summary.

### Expected output

```
54 passed, 1 skipped in ~8s
```

Admin suite alone:

```
14 passed in ~3s
```

The skipped test is `test_real_gemini_integration`, which requires
`RUN_REAL_GEMINI_TESTS=1` and a real `GEMINI_API_KEY`.

---

## 3. Test Isolation

`tests/conftest.py` configures the environment **before** importing the app:

| Variable | Test value |
|----------|------------|
| `DATABASE_URL` | `sqlite:///./test_suite.db` |
| `JWT_SECRET_KEY` | `test-only-secret-key-not-for-production-0123456789` |
| `ADMIN_BOOTSTRAP_EMAIL` | `admin@grievance.gov.in` |
| `ADMIN_BOOTSTRAP_PASSWORD` | `Admin@123456` |
| `ADMIN_BOOTSTRAP_NAME` | `Chief Grievance Officer` |
| `UPLOAD_DIR` | `test_uploads` |
| `GEMINI_API_KEY` | empty (deterministic fallback) |

Behaviour:

- Any previous `backend/test_suite.db` is deleted, then a fresh schema is
  created with `Base.metadata.create_all`.
- `seed_database()` inserts the 16 services, 20 knowledge documents and the
  test administrator.
- `test_uploads/` is removed before the run.
- The `client` fixture overrides `get_db` with the test session and uses
  `base_url="http://testserver/api/v1"`, so tests call `/auth/login`,
  `/grievances`, etc.
- The app lifespan is intentionally not executed by the fixture (plain
  `TestClient`), so tests do not touch the development database.

These credentials are **test fixtures only** and are not used in production.

> Tests share one SQLite database for the whole session. They are written to use
> unique emails and to assert on relative counts where necessary, so they do not
> depend on execution order.

---

## 4. Backend Test Inventory

### 4.1 `test_api.py` (15 tests)

| Test | What it proves |
|------|----------------|
| `test_01_citizen_registration` | Registration returns 201, role is citizen, no hash leaks |
| `test_02_duplicate_email_rejection` | Duplicate email returns 409 |
| `test_03_successful_login` | Login returns a bearer token |
| `test_04_invalid_password` | Wrong password returns 401 |
| `test_05_access_protected_api_without_auth` | `/auth/me` without token returns 401 |
| `test_06_invalid_or_expired_jwt` | Malformed JWT returns 401 |
| `test_07_citizen_access_own_grievance` | Owner can create and read a grievance |
| `test_08_citizen_cannot_access_another_citizens_grievance` | Detail and tracking are ownership-checked (403) |
| `test_09_admin_only_access` | Citizens get 403; admin gets 200 on `/admin/stats` |
| `test_10_grievance_submission` | 201, `GRV-` reference, status `Submitted` |
| `test_11_invalid_grievance_input` | Short fields return 422 |
| `test_12_and_13_grievance_status_update_and_history_persistence` | Admin transitions create history entries |
| `test_14_service_directory_retrieval` | Seeded directory is returned |
| `test_15_service_search` | Keyword search works |
| `test_16_ai_handling_of_unsupported_questions` | Unsupported question returns no sources |

### 4.2 `test_extended.py` (25 passing + 1 skipped)

Registration / auth:

- Weak passwords (`short1`, `onlyletters`, `12345678`, `Ab1`) → 422
- Public registration cannot create an admin
- Duplicate email is case-insensitive
- Protected endpoints return 401 without a token
- Admin cannot submit a citizen grievance

Grievance lifecycle:

- Summary endpoint returns real per-user status counts
- Tracking by reference number works; initial history is `Submitted`
- Invalid category returns 400
- List search and pagination behave correctly
- Every status transition is preserved in history with remarks
- Invalid status returns 400

Attachments:

- Valid PNG upload returns a `/uploads/` path and is served back
- `.txt` upload is rejected
- Empty upload is rejected
- Traversal-style `attachment_path` is rejected with 422

Services / admin:

- Service detail, categories and 404 for unknown id
- Citizens cannot call admin stats, analytics or listing
- Admin can search/filter by status and category, read any grievance, and
  stats/analytics agree

AI:

- Chat sessions are private to their owner
- Supported questions return grounded sources with titles and review dates
- Mocked Gemini is used when a key is configured; the prompt contains
  `VERIFIED SOURCES` and the configured model name is used
- Real Gemini integration is opt-in and skipped by default

Health:

- `GET /health` returns `healthy`

### 4.3 `test_admin_dashboard.py` (14 tests)

Authentication / authorization:

- Valid admin login succeeds; an invalid admin password returns 401
- `/admin/stats`, `/admin/analytics`, `/admin/grievances` and history require a
  token (401 without one)
- A citizen receives 403 on every admin endpoint and cannot update status
- A citizen cannot read another citizen's grievance or history
- Bootstrap preserves an existing admin password and refuses to promote an
  existing citizen account

Register:

- Admin sees all grievances and can search by citizen name, email, category and
  subject marker
- Comma-separated status groups filter the pending/resolved queues
- `sort=status` returns records in workflow order; invalid status returns 400
  and an invalid sort returns 422
- Date range filters, pagination metadata and `date_from > date_to` validation
- Unknown grievance/history returns 404; empty searches return an empty page

Status updates and audit trail:

- Each update creates a new history row and returns the updated detail
- Previous history rows and remarks remain unchanged
- The new row records the administrator name and old/new status
- The citizen sees the updated status and history
- Invalid status is rejected without creating history; missing record returns 404

Dashboard:

- Counts, `pending`, category distribution, recent grievances and recent
  updates match direct database aggregates
- `/admin/analytics` agrees with `/admin/stats`
- Empty search results are handled gracefully

---

## 5. Mocked vs Real Gemini

| Mode | How | What is verified |
|------|-----|------------------|
| Default (mock) | `GEMINI_API_KEY` empty, or monkeypatched `genai` | Retrieval, prompt construction, source propagation, persistence |
| Deterministic fallback | Empty key | Answer is assembled from curated rows |
| Real integration (opt-in) | `RUN_REAL_GEMINI_TESTS=1` + real key | Live Gemini call returns synthesized content and sources; the deterministic fallback is rejected |

Automated CI never calls the Gemini API. The opt-in test is clearly marked with
`@pytest.mark.skipif` and a reason string.

---

## 6. Frontend Verification

```powershell
cd frontend
npm run build
```

This runs `tsc -b && vite build`. A successful run ends with:

```
✓ built in <1s
dist/index.html
dist/assets/index-*.css
dist/assets/index-*.js
```

Expected warning (non-fatal): the main JS chunk exceeds 500 kB. This is a
bundle-size advisory, not a build failure. Code-splitting is a future
optimization, not a correctness issue.

Optional local checks:

```powershell
cd frontend
npm run lint      # oxlint
npm run dev       # http://localhost:5173
```

---

## 7. Manual End-to-End Checklist

Start the backend and frontend first (see `README.md`), then verify:

1. **Landing** loads and links to services, login and registration.
2. **Register** a citizen; weak passwords are rejected inline.
3. **Login** succeeds; reloading the page keeps the session (`/auth/me`).
4. **Dashboard** shows counts from `/grievances/summary`.
5. **Service directory** lists 16 services; search and category filters work.
6. **Service detail** shows eligibility, documents, procedure and source link.
7. **Submit grievance** creates a record with a `GRV-` reference.
8. **Attachment**: upload a PNG/PDF and confirm the detail page link opens it.
9. **My grievances** supports search, status filter and pagination.
10. **Tracking** by reference number returns the record and history.
11. **AI assistant** answers a supported question with source titles and says it
    lacks verified information for an unrelated question.
12. **Profile** shows the logged-in user.
13. **Admin login** lands on `/admin` with real totals, pending banner, status
    and category distributions, recent grievances and latest updates.
14. **Admin list** supports search (reference/citizen/subject/category/location),
    status/category/date filters, newest/oldest/status sorting and pagination.
15. **Pending / Resolved / Rejected** pages show only their status groups and
    reuse the same register API.
16. **Admin detail** shows citizen data, complaint, attachment and chronological
    history; a status change with remarks asks for confirmation, appends an
    audit entry and refreshes the record.
17. **Citizen view** shows the new status and history entry after refresh.
18. **Admin profile** shows the signed-in account; sign-out clears the session.
19. **Authorization**: a citizen visiting `/admin` is redirected; an admin
    visiting `/dashboard` is redirected; a citizen opening another citizen's
    grievance URL sees an access-denied state.

---

## 8. Known Gaps

- Real Gemini was not executed in this environment (no API key).
- Alembic was verified against SQLite, not the target Supabase instance.
- No browser automation (Playwright/Cypress) is included; the manual checklist
  above covers the UI flows.
- Uploads are stored on the local filesystem; tests use a throwaway
  `test_uploads/` directory.
