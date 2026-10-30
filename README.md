# Public Grievance AI Assistant

> **Project ID:** HACK-P438
> **Category:** Government and Public Services
> **Stack:** React + Vite + TypeScript + Tailwind · FastAPI + SQLAlchemy 2.0 + PostgreSQL (Supabase) · Gemini

A full-stack citizen grievance and public-service portal. Citizens can browse a
curated service directory, ask an AI assistant grounded in that directory, file
grievances with optional evidence, and track every status change. Administrators
get real dashboard analytics and a status-update workflow with an append-only
audit trail.

---

## Table of Contents

1. [Features](#1-features)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Backend Setup](#5-backend-setup)
6. [Frontend Setup](#6-frontend-setup)
7. [Environment Variables](#7-environment-variables)
8. [Database, Migrations and Seed Data](#8-database-migrations-and-seed-data)
9. [Running the Application](#9-running-the-application)
10. [Testing and Build](#10-testing-and-build)
11. [API Overview](#11-api-overview)
12. [Security Notes](#12-security-notes)
13. [Deployment](#13-deployment)
14. [Known Limitations](#14-known-limitations)

---

## 1. Features

### Citizen

- Register and log in with email + password (Argon2 hashing, JWT sessions).
- Landing page, dashboard, profile and a public service directory.
- Search the directory by keyword and filter by category.
- View eligibility, required documents, procedure and official source for each
  service.
- Ask the AI assistant questions; answers are grounded in curated knowledge
  documents and services, with source title, URL and last-reviewed date.
- Submit a grievance with subject, description, category and location.
- Optionally attach a JPEG/PNG/PDF (validated, max 5 MB) and open it later.
- Receive a unique reference number (`GRV-YYYYMMDD-XXXX`).
- List, search, filter and paginate personal grievances.
- Track by reference number and view the complete status history.
- Symmetric citizen dashboard with four summary cards, a status snapshot,
  resolution rate, recent grievances and quick actions; all values come from
  real database aggregates.

### Administrator

- Dedicated admin console with a navy sidebar, breadcrumbs and a responsive
  layout that is separate from the citizen portal.
- Live overview of total / submitted / under-review / in-progress / resolved /
  rejected counts, pending queue size, status and category distributions,
  resolution rate, recent grievances and the latest audit updates.
- Grievance register with server-side search (reference, citizen name/email,
  subject, description, category, location), status groups, category and date
  filters, newest/oldest/status sorting and pagination.
- Dedicated pending (submitted + under review + in progress), resolved and
  rejected queues backed by the same API.
- Full grievance detail: citizen information, complete complaint, attachment,
  current status and chronological status history.
- Status updates with optional administrative remarks, a confirmation dialog and
  toast feedback. Every change appends an immutable `grievance_history` row with
  the administrator ID and timestamp.
- Admin profile/account page and service directory access.
- Loading skeletons, empty states, error recovery and server-side validation
  throughout.

### Platform

- Server-side RBAC (`citizen` / `admin`) and per-resource ownership checks.
- Alembic migration covering all seven tables, foreign keys, indexes and check
  constraints.
- Idempotent seed scripts for services, knowledge documents and the bootstrap
  administrator.
- No hardcoded credentials or committed secrets.
- Responsive UI with explicit loading and error states.

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Routing | React Router v7 |
| Forms / validation | React Hook Form + Zod |
| HTTP | Axios |
| Icons | lucide-react |
| Backend | FastAPI, Pydantic v2 |
| ORM | SQLAlchemy 2.0 (synchronous `Session`) |
| Migrations | Alembic |
| Database | PostgreSQL 15 on Supabase (SQLite for local dev/tests) |
| Driver | psycopg 3 (`postgresql+psycopg://`) |
| Auth | JWT HS256 (`python-jose`), Argon2 (`argon2-cffi`) |
| AI | Google Gemini (`google-generativeai`), optional |
| Tests | Pytest + FastAPI `TestClient` |

No vector database, embeddings, maps, speech recognition or full-text search
engine is used. AI grounding is keyword search over curated relational data.

---

## 3. Project Structure

```
Externalsssss/
├── README.md
├── render.yaml              # Render Blueprint (secrets prompted, not committed)
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── ARCHITECTURE.md
│   ├── CLOUD_DEPLOYMENT.md
│   ├── DATABASE_SCHEMA.md
│   └── TESTING.md
├── backend/
│   ├── .env.example
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── alembic/versions/0001_initial_schema.py
│   ├── app/                 # api, core, database, models, schemas, services
│   ├── scripts/             # seed_data.py, create_admin.py,
│   │                        # migrate_sqlite_to_postgres.py
│   └── tests/               # conftest.py, test_api.py, test_extended.py,
│                            # test_admin_dashboard.py, test_migration.py
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vercel.json          # Vite build + SPA rewrites
    └── src/                 # components, context, pages, services, types
```

Detailed design: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Schema: [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md).
Endpoints: [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md).

---

## 4. Prerequisites

- Python 3.11+ (the checked-in environment uses Python 3.13.6)
- Node.js 20+ and npm
- PostgreSQL 15+ (Supabase) for production; SQLite works for local development
- Optional: a Google Gemini API key
- Optional: a Supabase project if you want to run against managed PostgreSQL

---

## 5. Backend Setup

All commands are run from the `backend/` directory. PowerShell examples are
shown; on macOS/Linux use `.venv/bin/python` instead of
`.venv\Scripts\python.exe`.

### 5.1 Create the virtual environment and install dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

If `.venv` already exists, skip the `python -m venv` step.

### 5.2 Configure environment

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env` and fill in at least:

```dotenv
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET_KEY=<random-48-byte-urlsafe-string>
```

Generate a secret:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

For a quick local run you can leave `DATABASE_URL` unset; the backend falls back
to `sqlite:///./grievance_dev.db`. If `JWT_SECRET_KEY` is unset, an ephemeral key
is generated at startup (tokens then do not survive a restart).

### 5.3 Apply migrations and seed

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m scripts.seed_data
```

`seed_data` is idempotent and inserts 16 services and 20 knowledge documents.

### 5.4 Create the administrator

Choose one approach:

**CLI flags**

```powershell
.\.venv\Scripts\python.exe -m scripts.create_admin `
  --email admin@example.gov.in `
  --password "StrongPass123" `
  --name "Chief Grievance Officer"
```

**Environment variables**

```dotenv
ADMIN_BOOTSTRAP_EMAIL=admin@example.gov.in
ADMIN_BOOTSTRAP_PASSWORD=StrongPass123
ADMIN_BOOTSTRAP_NAME=Chief Grievance Officer
```

```powershell
.\.venv\Scripts\python.exe -m scripts.create_admin
```

There are **no default admin credentials**. Public registration can only create
citizens. The admin password must be at least 8 characters and contain at least
one letter and one digit.

Bootstrap safety rules:

- An administrator is created only when the email does not already exist.
- If an administrator already exists, the account and its password are preserved.
- If the email belongs to an existing **citizen**, bootstrap refuses to promote
  it and logs an error. Use a different administrator email.
- Running `create_admin` again never resets an existing administrator password.
- To rotate a password, create a new administrator email or update the account
  through a deliberate administrative procedure.

### 5.5 Start the API

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API root: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health: `http://localhost:8000/api/v1/health`

The startup lifespan also creates missing tables and seeds reference data, so a
fresh local database works even if you skip the explicit seed step.

---

## 6. Frontend Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

`frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Start the dev server:

```powershell
npm run dev
```

Open `http://localhost:5173`.

Production build:

```powershell
npm run build
```

The output is written to `frontend/dist/`.

---

## 7. Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ENVIRONMENT` | Production | `development` | Set to `production` to enable strict guards |
| `DATABASE_URL` | Production | `sqlite:///./grievance_dev.db` | PostgreSQL/SQLite connection string |
| `JWT_SECRET_KEY` | Production | ephemeral generated key | JWT signing secret (min 32 chars in production) |
| `JWT_ALGORITHM` | No | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` | Token lifetime (24 h) |
| `GEMINI_API_KEY` | No | empty | Enables Gemini synthesis; empty uses deterministic fallback |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model id |
| `FRONTEND_URL` | No | `http://localhost:5173` | Added to CORS origins |
| `CORS_ORIGINS` | No | local dev origins | Extra allowed origins |
| `UPLOAD_DIR` | No | `uploads` | Attachment storage directory |
| `MAX_UPLOAD_SIZE_MB` | No | `5` | Attachment size limit |
| `ADMIN_BOOTSTRAP_EMAIL` | No | empty | Admin email for bootstrap/CLI |
| `ADMIN_BOOTSTRAP_PASSWORD` | No | empty | Admin password (min 8 chars, letter + digit) |
| `ADMIN_BOOTSTRAP_NAME` | No | `System Administrator` | Admin display name |

`ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are used only to create a
missing administrator. They never reset an existing account and never promote an
existing citizen.

When `ENVIRONMENT=production`, startup refuses to run with a SQLite
`DATABASE_URL` or a `JWT_SECRET_KEY` shorter than 32 characters.

### Frontend (`frontend/.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_API_BASE_URL` | No | `http://localhost:8000/api/v1` | Backend API base URL |

`.env` files are ignored by Git. Never commit real secrets.

---

## 8. Database, Migrations and Seed Data

```powershell
cd backend

# Apply all migrations
.\.venv\Scripts\python.exe -m alembic upgrade head

# Current revision
.\.venv\Scripts\python.exe -m alembic current

# Roll back (development only)
.\.venv\Scripts\python.exe -m alembic downgrade base
```

The single revision `0001_initial_schema` creates:

`users`, `services`, `grievances`, `grievance_history`, `knowledge_documents`,
`chat_sessions`, `chat_messages` — with foreign keys, check constraints and
indexes.

Seed commands:

```powershell
.\.venv\Scripts\python.exe -m scripts.seed_data
.\.venv\Scripts\python.exe -m scripts.create_admin --email admin@example.gov.in --password "StrongPass123"
```

Grievance statuses: `Submitted`, `Under Review`, `In Progress`, `Resolved`,
`Rejected`.

---

## 9. Running the Application

Two terminals:

**Terminal 1 — backend**

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend**

```powershell
cd frontend
npm run dev
```

Then open `http://localhost:5173`.

Quick smoke test:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health
Invoke-RestMethod http://localhost:8000/api/v1/services
```

### 9.1 Admin dashboard walkthrough

1. Open `http://localhost:5173` and choose **Login as Admin** in the header, or
   go directly to `http://localhost:5173/login?role=admin`. Both open the same
   shared sign-in form; the query parameter only changes the heading and helper
   text.
2. Sign in with the administrator email/password created in section 5.4. The
   shared login endpoint validates the password against the database and the app
   redirects administrators to `/admin`. A citizen signing in through the admin
   entry point is still sent to `/dashboard`, because the server role decides the
   redirect.
3. The sidebar exposes: **Dashboard**, **All Grievances**, **Pending Queue**,
   **Resolved**, **Rejected**, **Service Directory** and **Admin Profile**.
4. Dashboard cards and charts are loaded from `GET /admin/stats`; no numbers are
   hardcoded. An empty database shows zero counts and empty-state panels.
5. Open **All Grievances** to search by reference, citizen, subject, category
   or location; filter by status, category or submission date; sort by
   newest/oldest/status; and page through results. Pending/Resolved/Rejected
   reuse the same register with a preset status group.
6. Open any record to review the complaint, citizen details, attachment and
   chronological audit trail. Choose a new status, optionally add remarks, and
   confirm the dialog. The citizen sees the new status and history entry after
   refreshing their grievance page.
7. **Admin Profile** shows the signed-in account and capabilities; **Sign Out**
   clears the session.

Citizens who try to open `/admin` are redirected to their own dashboard. The
admin APIs independently enforce `role == "admin"` and return `403` for citizens
and `401` for unauthenticated requests.

---

## 10. Testing and Build

### Backend tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

Current result:

```
54 passed, 1 skipped in ~8s
```

The skipped test is the opt-in real Gemini integration test. It runs only when
`RUN_REAL_GEMINI_TESTS=1` and a real `GEMINI_API_KEY` are present.

Admin-specific suite:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_admin_dashboard.py -q
```

It covers admin login, invalid passwords, unauthenticated/citizen rejection,
bootstrap safety, search, status groups, date filters, sorting, pagination,
detail/history access, status updates, invalid statuses, immutable audit history
and dashboard statistics computed from the database.

Tests use an isolated SQLite database (`backend/test_suite.db`) and a throwaway
`backend/test_uploads/` directory; they do not touch development data. See
[`docs/TESTING.md`](docs/TESTING.md) for the full inventory.

### Frontend build

```powershell
cd frontend
npm run build
```

`tsc -b && vite build` succeeds. Vite prints a non-fatal warning when the main
chunk exceeds 500 kB.

### Frontend lint (optional)

```powershell
cd frontend
npm run lint
```

---

## 11. API Overview

Base URL: `http://localhost:8000/api/v1`

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| Services | `GET /services`, `GET /services/categories`, `GET /services/{id}` |
| Grievances | `GET/POST /grievances`, `GET /grievances/summary`, `GET /grievances/categories`, `POST /grievances/attachments`, `GET /grievances/track/{ref}`, `GET /grievances/{id}`, `GET /grievances/{id}/history` |
| AI chat | `POST /chat`, `GET /chat/history`, `GET/POST /chat/sessions`, `GET/POST /chat/sessions/{id}/messages` |
| Admin | `GET /admin/stats`, `GET /admin/analytics`, `GET /admin/grievances`, `GET /admin/grievances/{id}`, `GET /admin/grievances/{id}/history`, `PATCH /admin/grievances/{id}/status` |
| System | `GET /`, `GET /health`, static `GET /uploads/{filename}` |

Full request/response examples: [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md).

---

## 12. Security Notes

- Passwords are hashed with Argon2 and never returned by any endpoint.
- Public registration forces `role = "citizen"`; there is no public admin signup.
- Admin APIs require a valid JWT whose database account has `role = "admin"`.
  Citizens receive `403`; unauthenticated requests receive `401`.
- Bootstrap never promotes an existing citizen and never resets an existing
  administrator password.
- Every protected route enforces role and ownership on the server.
- Grievance detail, tracking, history and chat sessions are owner-scoped; admins
  may read all grievances but not other users' chat sessions.
- Attachments are validated by extension, MIME type, size and emptiness, stored
  under UUID filenames, and re-validated when attached to a grievance.
- No default JWT secret or default admin credentials ship in the repository.
- CORS is restricted to configured origins.
- `.env`, local databases and upload directories are git-ignored.

---

## 13. Deployment

Production architecture:

```
Vercel (React/Vite SPA) ──HTTPS──> Render (FastAPI) ──psycopg3──> Supabase PostgreSQL
                                        └──> Gemini API (server-side only)
```

The full runbook, including environment setup and verification steps, is in
[`docs/CLOUD_DEPLOYMENT.md`](docs/CLOUD_DEPLOYMENT.md). The repository contains a
Render Blueprint (`render.yaml`) and a Vercel configuration
(`frontend/vercel.json`).

### Backend — Render

- Service type: Web Service, runtime Python, root directory `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/api/v1/health`
- Free plan; the blueprint marks every secret `sync: false` so no value is
  stored in Git.
- On PostgreSQL, the app applies Alembic migrations at startup
  (non-destructive; existing schemas are stamped, never dropped).
- Set `DATABASE_URL` to the Supabase pooled connection string
  (`postgresql+psycopg://...:6543/...?sslmode=require`), plus
  `ENVIRONMENT=production`, `JWT_SECRET_KEY`, `FRONTEND_URL` and the admin
  bootstrap variables. `GEMINI_API_KEY` is optional.
- Uploads use the local filesystem. Render's free plan has an ephemeral disk, so
  attachments do not survive a redeploy; attach a paid persistent disk or move
  uploads to object storage before relying on them.

### Frontend — Vercel

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- SPA rewrites are configured in `frontend/vercel.json`
- Environment: `VITE_API_BASE_URL=https://<backend-host>/api/v1`
- Only this public URL belongs in the frontend. Never add `GEMINI_API_KEY`,
  `DATABASE_URL`, `JWT_SECRET_KEY` or admin bootstrap values to Vercel.

### Database — Supabase

1. Create the project and copy the **pooled** connection string (port `6543`,
   `sslmode=require`).
2. Use it as Render's `DATABASE_URL`; migrations run automatically on first
   boot.
3. To preserve local data, run the additive copy script from `backend/`:

   ```powershell
   .\.venv\Scripts\python.exe -m scripts.migrate_sqlite_to_postgres --dry-run
   .\.venv\Scripts\python.exe -m scripts.migrate_sqlite_to_postgres
   ```

   The script never updates or deletes rows, preserves IDs/reference numbers and
   timestamps, remaps users by email and grievances by reference number, and
   supports `--skip-chat`.

### Post-deploy checks

1. `GET /api/v1/health` returns `healthy` with `"database": "connected"`.
2. `/api/v1/services` returns 16 seeded services.
3. Citizen registration and login work.
4. Admin login reaches `/admin` with real counts.
5. Grievance submission, attachment upload and status update work end to end.
6. A grievance is still visible after a page refresh and a fresh sign-in.
7. The AI assistant returns grounded sources for a supported question and a
   "no verified information" answer for an unsupported one.

---

## 14. Known Limitations

- **Cloud deployment requires account access.** Supabase project creation,
  Render authentication and `vercel login` were not available in this
  environment, so the live services are not deployed yet. See
  [`docs/CLOUD_DEPLOYMENT.md`](docs/CLOUD_DEPLOYMENT.md) for the exact steps.
- **Live PostgreSQL was validated offline.** The Alembic PostgreSQL SQL was
  generated successfully and the copy script is covered by tests, but no live
  Supabase connection string was available to run against a real server.
- **Real Gemini test is opt-in** and skipped by default; the deterministic
  fallback works without a key.
- **Uploads use local filesystem storage.** Render's free tier has an ephemeral
  disk, so files are lost on redeploy.
- **AI retrieval is keyword-based** (`ILIKE`), not semantic; unrelated questions
  intentionally return a "no verified information" response.
- **No refresh tokens, email verification or password reset** are implemented.
- **No browser automation tests**; UI flows are covered by the manual checklist
  in `docs/TESTING.md`.
