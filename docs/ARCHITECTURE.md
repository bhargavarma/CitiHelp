# ARCHITECTURE — Public Grievance AI Assistant

> **Project ID:** HACK-P438
> **Category:** Government and Public Services
> **Last Updated:** 2026-10-31

This document describes the system **as implemented**. Anything that is planned
but not built is called out explicitly under [Known constraints](#10-known-constraints).

---

## 1. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                           │
│  React 19 · Vite 8 · TypeScript · Tailwind CSS v4                  │
│  React Router v7 · Axios · React Hook Form · Zod · lucide-react    │
│  JWT persisted in localStorage, re-validated through /auth/me      │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS REST/JSON + multipart uploads
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Render)                           │
│  FastAPI · Pydantic v2 · SQLAlchemy 2.0 (synchronous)              │
│  Alembic · Argon2 (argon2-cffi) · JWT (python-jose)                │
│  Google Gemini SDK (server-side only)                              │
│  Static /uploads mount for validated grievance attachments         │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ psycopg 3 (synchronous driver)
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL 15 (Supabase)                       │
│  users · services · grievances · grievance_history                 │
│  knowledge_documents · chat_sessions · chat_messages               │
└────────────────────────────────────────────────────────────────────┘
```

The frontend and backend are deployed independently and communicate only over
HTTP. There is no server-side rendering and no shared runtime state.

---

## 2. Technology Stack (actual)

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend framework | React 19 + TypeScript | Function components and hooks |
| Build tool | Vite 8 | `tsc -b && vite build` |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | `@import "tailwindcss";` in `index.css` |
| Routing | React Router v7 (`BrowserRouter`) | Public, citizen and admin route groups |
| HTTP client | Axios | Base URL from `VITE_API_BASE_URL` |
| Forms | React Hook Form + Zod | Client-side validation mirrors backend rules |
| Icons | lucide-react | No component library / shadcn |
| Backend framework | FastAPI | Routers mounted under `/api/v1` |
| Validation | Pydantic v2 | `ConfigDict`, `field_validator` |
| ORM | SQLAlchemy 2.0 **synchronous** | `create_engine` + `Session` |
| Migrations | Alembic | Single revision `0001_initial_schema` |
| Database | PostgreSQL 15 (Supabase) | SQLite supported for local dev/tests |
| DB driver | psycopg 3 (`postgresql+psycopg://`) | Sync driver |
| Password hashing | Argon2 (`argon2-cffi`) | Hashes never returned by the API |
| Tokens | JWT HS256 (`python-jose`) | Bearer token in `Authorization` |
| AI | Google Gemini (`google-generativeai`) | Optional; deterministic fallback exists |
| Tests | Pytest + FastAPI `TestClient` (HTTPX) | Isolated SQLite test database |

There is **no** vector database, embedding store, full-text `tsvector` column,
or retrieval-augmented generation pipeline. AI grounding is keyword search over
curated relational tables (see section 6).

---

## 3. Repository Structure

```
Externalsssss/
├── README.md
├── .gitignore
├── docs/
│   ├── API_DOCUMENTATION.md      # Authoritative endpoint reference
│   ├── ARCHITECTURE.md           # This document
│   ├── DATABASE_SCHEMA.md        # Tables, constraints, indexes
│   ├── TESTING.md                # Test strategy and commands
│   ├── API_SPECIFICATION.md      # Legacy stub -> points here
│   ├── DEVELOPMENT_PLAN.md       # Planning artefact
│   ├── PROJECT_BLUEPRINT.md      # Planning artefact
│   └── SECURITY_PLAN.md          # Planning artefact
├── backend/
│   ├── .env.example
│   ├── alembic.ini
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── alembic/
│   │   ├── env.py                # Synchronous migration runner
│   │   └── versions/0001_initial_schema.py
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS, routers, /uploads mount
│   │   ├── api/                  # auth, services, grievances, chat, admin
│   │   ├── core/                 # config, security, dependency guards
│   │   ├── database/             # engine/session factory, seed routines
│   │   ├── models/               # 7 SQLAlchemy models
│   │   ├── schemas/              # Pydantic request/response models
│   │   └── services/ai_service.py
│   ├── scripts/
│   │   ├── create_admin.py       # Admin bootstrap CLI
│   │   └── seed_data.py          # Reference data CLI
│   └── tests/
│       ├── conftest.py
│       ├── test_api.py
│       └── test_extended.py
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx               # Route table
        ├── main.tsx
        ├── index.css
        ├── components/           # Layout, ProtectedRoute, StatusBadge
        ├── context/AuthContext.tsx
        ├── pages/                # Landing, Login, Register, NotFound
        │   ├── citizen/          # Dashboard, services, grievances, AI, profile
        │   └── admin/            # Dashboard, list, detail/status update
        ├── services/api.ts       # Axios client + endpoint wrappers
        └── types/index.ts
```

---

## 4. Backend Architecture

### 4.1 Application startup

`app/main.py` builds the FastAPI application and runs a lifespan handler that:

1. Calls `Base.metadata.create_all(bind=engine)` as a development safety net.
2. Runs `seed_database(session)`, which:
   - creates the administrator **only** when `ADMIN_BOOTSTRAP_EMAIL` and
     `ADMIN_BOOTSTRAP_PASSWORD` are both set;
   - preserves an existing administrator without resetting its password;
   - refuses to promote an existing citizen account and logs an error instead;
   - seeds the 16 public services and 20 curated knowledge documents when the
     corresponding tables contain fewer rows than expected.
3. Mounts `/uploads` with `StaticFiles`.

In production the schema should be created with Alembic
(`alembic upgrade head`); `create_all` exists so a fresh local checkout starts
without extra steps.

### 4.2 Routers

| Prefix | Module | Responsibility |
|--------|--------|----------------|
| `/api/v1/auth` | `app/api/auth.py` | Citizen registration, login, `/me`, logout |
| `/api/v1/services` | `app/api/services.py` | Public read-only service directory |
| `/api/v1/grievances` | `app/api/grievances.py` | Submission, listing, tracking, history, attachments, summary |
| `/api/v1/chat` | `app/api/chat.py` | AI sessions, messages, direct chat, history |
| `/api/v1/admin` | `app/api/admin.py` | Stats/analytics, filtered all-grievance register, detail, chronological history, status updates |
| `/uploads/*` | `main.py` | Static serving of validated attachments |

`GET /api/v1/health` and `GET /` are unauthenticated liveness endpoints.

### 4.3 Dependency guards

`app/core/deps.py` defines three composable dependencies:

- `get_current_user` — decodes the Bearer JWT, loads the user, rejects missing,
  invalid/expired tokens (401) and deactivated accounts (403).
- `require_admin` — `get_current_user` + `role == "admin"` (403 otherwise).
- `require_citizen` — `get_current_user` + `role == "citizen"` (403 otherwise).
  Administrators therefore **cannot** submit citizen grievances.

Authorization is enforced on the server for every protected route; the frontend
guards are a usability layer only.

### 4.4 Authentication flow

```
Register:  POST /auth/register
           -> Pydantic validation (email, name, password strength)
           -> email lower-cased, uniqueness checked (409 on duplicate)
           -> Argon2 hash stored, role forced to "citizen"
           -> 201 with public user fields (no hash)

Login:     POST /auth/login
           -> email lower-cased, Argon2 verify
           -> 401 on unknown user or bad password
           -> 403 if account deactivated
           -> HS256 JWT {sub, email, role, exp} returned

Requests:  Authorization: Bearer <token>
           -> get_current_user resolves the DB row on every request

Frontend:  token stored in localStorage
           -> AuthContext calls /auth/me on load
           -> 401 interceptor clears storage and redirects to /login
```

JWT expiry defaults to 1440 minutes (24 hours). If `JWT_SECRET_KEY` is not set,
the backend generates an ephemeral key at startup and logs a warning; tokens do
not survive a process restart in that mode.

### 4.5 Data access

`app/database/session.py` normalises the configured URL:

- `postgres://` and `postgresql://` → `postgresql+psycopg://`
- `sqlite+aiosqlite://` → `sqlite://`

It then creates a **synchronous** `Engine` with `pool_pre_ping=True` and a
`sessionmaker` exposed through the `get_db` FastAPI dependency. Each request
gets one session that is closed in a `finally` block.

### 4.6 Validation and error handling

- Request bodies are validated by Pydantic v2 (422 on failure).
- Domain rules raise `HTTPException` with explicit codes:
  - 400 — invalid grievance category, invalid status, bad attachment type/empty
  - 401 — missing/invalid credentials
  - 403 — role mismatch, non-owner access, deactivated account
  - 404 — unknown grievance, service, session or reference number
  - 409 — duplicate email
  - 413 — attachment over the size limit
- Grievance status changes always insert a `grievance_history` row; the current
  status is never updated without an audit record.

### 4.7 File uploads

`POST /api/v1/grievances/attachments` (citizen only):

1. Rejects extensions outside `.jpg`, `.jpeg`, `.png`, `.pdf`.
2. Rejects content types outside `image/jpeg`, `image/png`, `application/pdf`.
3. Rejects empty files and files larger than `MAX_UPLOAD_SIZE_MB` (default 5).
4. Writes the bytes under `UPLOAD_DIR` with a UUID filename.
5. Returns `{ "path": "/uploads/<uuid>.<ext>", "original_filename", "size" }`.

The returned `path` is validated against `^/uploads/[A-Za-z0-9_.-]+$` when a
grievance is submitted, preventing arbitrary paths from being stored. The file
is served read-only from the `/uploads` static mount.

---

## 5. Frontend Architecture

### 5.1 Route map

| Path | Access | Page |
|------|--------|------|
| `/` | Public | Landing |
| `/login` | Public | Shared login (admin entry uses `?role=admin` for copy only) |
| `/register` | Public | Citizen registration |
| `/services` | Public | Service directory |
| `/services/:id` | Public | Service detail |
| `/dashboard` | Citizen | Dashboard with real summary counts |
| `/assistant` | Citizen | AI assistant (sessions + messages) |
| `/grievances/new` | Citizen | Submit grievance (optional upload) |
| `/grievances` | Citizen | My grievances (search/filter/pagination) |
| `/grievances/:id` | Citizen (owner) | Grievance detail + history |
| `/profile` | Citizen | Profile |
| `/admin` | Admin | Dashboard: counts, pending banner, distributions, recent activity |
| `/admin/analytics` | Admin | Redirects to `/admin` |
| `/admin/grievances` | Admin | All grievances: search, filters, sorting, pagination |
| `/admin/grievances/pending` | Admin | Submitted + under review + in progress |
| `/admin/grievances/resolved` | Admin | Resolved queue |
| `/admin/grievances/rejected` | Admin | Rejected queue |
| `/admin/grievances/:id` | Admin | Detail, attachment, history, status update, remarks |
| `/admin/services` | Admin | Service directory inside the admin shell |
| `/admin/profile` | Admin | Account, capabilities, session security |
| `*` | Public | Not found |

`ProtectedRoute` waits for `AuthContext` to finish `/auth/me`, redirects
unauthenticated users to `/login`, sends admins away from citizen-only pages to
`/admin`, and sends citizens away from admin pages to `/dashboard`.

The landing header exposes **Log in**, **Login as Admin** and **Register
Citizen**. The admin button links to `/login?role=admin`, which only changes the
heading and helper copy on the same form; it is not a separate auth path. The
server-validated `user.role` still decides whether the app navigates to `/admin`
or `/dashboard`, so a citizen using the admin entry point cannot reach the admin
console.

### 5.2 State and data flow

- `AuthContext` owns `user`, `token`, `isAuthenticated`, `isAdmin`, `isLoading`.
- `services/api.ts` owns one Axios instance with:
  - a request interceptor that attaches the stored JWT;
  - a response interceptor that clears storage and redirects on 401;
  - typed wrappers for every backend endpoint.
- Pages fetch on mount with `useEffect`, render explicit loading states, and
  surface API error messages in the UI. No page reads data from hardcoded
  arrays or uses `localStorage` as a database.
- Uploaded attachments are rendered as links built by `getUploadUrl()`, which
  derives the backend origin from `VITE_API_BASE_URL`.

### 5.3 Validation parity

| Rule | Backend | Frontend |
|------|---------|----------|
| Password length | ≥ 8 | ≥ 8 |
| Password content | ≥ 1 letter, ≥ 1 digit | same regexes |
| Full name | 2–255 chars | ≥ 2 chars |
| Grievance subject | 5–255 chars | 5–255 chars |
| Description | 15–5000 chars | 15–5000 chars |
| Location | 3–255 chars | ≥ 3 chars |
| Attachment | JPEG/PNG/PDF, ≤ 5 MB | same pre-check |

The backend remains authoritative; frontend checks exist to shorten feedback
loops, not to replace server validation.

---

## 6. AI Assistant Pipeline

```
Citizen question
      │
      ▼
extract_keywords()            lower-case, strip punctuation, remove stopwords
      │
      ▼
search_knowledge_and_services()
      │  ILIKE keyword search over
      │  knowledge_documents(title, content, category)
      │  services(name, description, procedure, category)
      ▼
matched records? ── no ──► fixed "no verified information" answer, sources = []
      │ yes
      ▼
GEMINI_API_KEY set? ── no ──► deterministic answer assembled from records
      │ yes
      ▼
Gemini prompt containing ONLY the verified source blocks
      │  (source title, URL, last-reviewed date, content)
      │  failure ──► log warning, deterministic fallback
      ▼
Answer + sources[{title, source_url, last_reviewed, relevance_type}]
      │
      ▼
Persist user message + assistant message (with sources JSON) in chat_messages
```

Guarantees:

- The Gemini key is read from backend settings only and is never sent to the
  browser.
- Sources returned to the client are exactly the database rows used as context;
  the service never fabricates a citation.
- When no curated record matches, the assistant says it lacks verified
  information and returns an empty source list.
- The deterministic fallback makes the assistant usable without a Gemini key.

---

## 7. Configuration

All backend configuration comes from environment variables or `backend/.env`
(see `backend/.env.example`). Key groups:

| Group | Variables |
|-------|-----------|
| Database | `DATABASE_URL` |
| Auth | `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` |
| AI | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| CORS | `FRONTEND_URL`, `CORS_ORIGINS` |
| Uploads | `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB` |
| Admin bootstrap | `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `ADMIN_BOOTSTRAP_NAME` |

The frontend reads one variable: `VITE_API_BASE_URL`
(default `http://localhost:8000/api/v1`).

No secrets are committed. `.env`, `*.db`, `uploads/` and `test_uploads/` are
ignored by Git.

---

## 8. Security Model

- Argon2id password hashing; plaintext passwords are never logged or returned.
- JWT HS256 with configurable secret and expiry.
- Server-side RBAC on every protected route.
- Resource ownership checks for grievance detail, tracking, history and chat
  sessions (admins may read all grievances, but chat sessions stay private).
- Public registration cannot set `role`; the backend forces `citizen`.
- No public admin registration; admins come from the bootstrap CLI/env.
- Upload validation covers extension, MIME type, emptiness, size and stored
  filename (UUID). Stored paths are re-validated on grievance submission.
- CORS is restricted to configured frontend origins.
- No default administrator credentials or default JWT secret ship with the
  codebase.

---

## 9. Deployment Topology

| Component | Target | Notes |
|-----------|--------|-------|
| Frontend | Vercel | Build `npm run build`, output `dist/`; set `VITE_API_BASE_URL` |
| Backend | Render | Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; run `alembic upgrade head` as a release/pre-deploy step |
| Database | Supabase PostgreSQL | Use the pooled `postgresql+psycopg://` connection string |
| Uploads | Backend filesystem | Render disks are ephemeral unless a persistent disk is attached; see constraints |

Required production secrets: `DATABASE_URL`, `JWT_SECRET_KEY`, `GEMINI_API_KEY`
(optional), `FRONTEND_URL`, and optional admin bootstrap values.

---

## 10. Known Constraints

- **Uploads on ephemeral storage.** Files written to `UPLOAD_DIR` are lost when
  an ephemeral Render instance is redeployed. Attach a persistent disk or move
  to object storage before production use.
- **Keyword AI retrieval.** Grounding uses `ILIKE` matching, not semantic
  search. Questions that share no keywords with curated records fall back to
  the "no verified information" response.
- **Real Gemini not exercised in CI.** Automated tests mock Gemini; the opt-in
  integration test requires `RUN_REAL_GEMINI_TESTS=1` and a real key.
- **SQLite migration verification.** The Alembic revision was verified against
  SQLite locally. Run `alembic upgrade head` against the Supabase instance and
  confirm before deploying.
- **No refresh tokens.** Expired access tokens require re-login.
- **No email verification / password reset.** Not part of the implemented scope.
