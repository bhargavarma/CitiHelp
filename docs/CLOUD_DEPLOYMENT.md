# CLOUD_DEPLOYMENT — CitiHelp (HACK-P438)

> **Last Updated:** 2026-10-31
> **Target architecture:** Vercel (React/Vite) → Render (FastAPI) → Supabase PostgreSQL
> **AI:** Google Gemini, called only from the backend

This document is the operational runbook for deploying CitiHelp. It records
what is already prepared in the repository, the exact external actions that
require account access, and the verification steps to run afterwards.

---

## 1. Deployment Status

| Component | Prepared | Deployed |
|-----------|----------|----------|
| Supabase PostgreSQL | Yes (migrations + copy script) | **No — project not created** |
| Render backend | Yes (`render.yaml`) | **No — not authenticated** |
| Vercel frontend | Yes (`frontend/vercel.json`) | **No — `vercel login` required** |
| Production admin | Yes (bootstrap script) | **No — needs Render env access** |

Nothing in this document claims a live service exists. The blockers are
external account access only.

What was verified locally against a real PostgreSQL 17 instance:

- `alembic upgrade head` created all 7 tables plus `alembic_version`
- production startup (`ENVIRONMENT=production`) seeded 16 services and 20
  knowledge documents and served a healthy `/api/v1/health`
- citizen registration/login, grievance creation, listing, persistence across a
  fresh app lifespan, and citizen→admin 403 enforcement
- admin login, dashboard stats, status update and history
- AI assistant: grounded sources for a supported question, zero sources for an
  unsupported one
- SQLite → PostgreSQL copy: 12 new rows, 36 seed rows skipped, second run
  inserted 0 (idempotent), foreign keys and timestamps preserved

---

## 2. Prerequisites

- GitHub repository: <https://github.com/bhargavarma/CitiHelp>
- A Supabase account (free tier is sufficient)
- A Render account (free tier is sufficient)
- A Vercel account (free tier is sufficient)
- Optional: a Gemini API key

Do not create paid resources. Every step below uses a free plan.

---

## 3. Step 1 — Create Supabase PostgreSQL

1. Sign in at <https://supabase.com/dashboard>.
2. **New project** → choose an organization, name (e.g. `citihelp`), a strong
   database password, and the region closest to the Render region.
3. Wait for provisioning to finish.
4. Open **Project Settings → Database → Connection string → URI**.
5. Copy the **pooled** connection string. It uses port `6543` and must include
   `sslmode=require`.

Convert it to the SQLAlchemy psycopg form:

```
postgresql+psycopg://postgres.<project-ref>:<password>@<host>:6543/postgres?sslmode=require
```

Notes:

- Keep this value out of Git, chat and logs.
- If the password contains special characters, URL-encode them.
- The direct connection (port `5432`) also works, but the pooled connection is
  recommended for Render.

**Nothing is destructive here.** The schema is created by Alembic on first
backend boot; no existing database is reset.

---

## 4. Step 2 — Deploy the backend on Render

### 4.1 Create the service

Use the Blueprint in the repository root:

1. Sign in at <https://dashboard.render.com>.
2. **New → Blueprint** → connect the `bhargavarma/CitiHelp` repository.
3. Render reads `render.yaml` and proposes one free Python web service named
   `citihelp-api` with:
   - root directory `backend`
   - build `pip install -r requirements.txt`
   - start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - health check `/api/v1/health`
4. Render prompts for every `sync: false` secret. Enter the values listed in
   section 6.

Alternatively create a Web Service manually with the same settings.

### 4.2 What startup does

`app.main.lifespan` runs `initialize_database()`:

- PostgreSQL → `alembic upgrade head` (non-destructive)
- Any other database → `Base.metadata.create_all`

Then `seed_database()` adds the 16 services and 20 knowledge documents if they
are missing, and creates the administrator only when both bootstrap variables
are set. Existing rows are never deleted or overwritten.

Startup fails fast if the database is unreachable, so a broken deployment does
not silently serve traffic.

### 4.3 Verify

```powershell
curl https://<backend-host>/api/v1/health
```

Expected:

```json
{"status":"healthy","service":"Public Grievance AI Assistant","environment":"production","database":"connected"}
```

If it returns 503, inspect the Render logs for the database error.

---

## 5. Step 3 — Preserve local SQLite data (optional but recommended)

Local inventory before migration:

| Table | Rows |
|-------|------|
| users | 1 citizen (0 admins) |
| services | 16 |
| knowledge_documents | 20 |
| grievances | 1 |
| grievance_history | 1 |
| chat_sessions | 3 |
| chat_messages | 6 |

Run from `backend/` with the Supabase URL in `DATABASE_URL`:

```powershell
# Preview: copies inside a transaction, then rolls back
.\.venv\Scripts\python.exe -m scripts.migrate_sqlite_to_postgres --dry-run

# Real copy
.\.venv\Scripts\python.exe -m scripts.migrate_sqlite_to_postgres
```

Options:

- `--source sqlite:///./grievance_dev.db` (default)
- `--target <url>` (default `DATABASE_URL`)
- `--skip-chat` to omit chat sessions and messages
- `--init-schema` to apply Alembic migrations first

Safety properties:

- additive and idempotent — a second run inserts nothing
- preserves IDs, reference numbers and timestamps
- matches users by email and grievances by reference number, remapping foreign
  keys instead of duplicating rows
- matches seeded services by name and knowledge documents by title, so a target
  that was seeded on first boot is not duplicated
- never updates or deletes existing target rows
- refuses to target SQLite unless `--allow-sqlite-target` is passed

If the backend has already started, the seed data exists; the script will skip
those rows and copy only the user, grievance, history and chat records.

---

## 6. Environment Variables

Configure these in **Render → Environment** (names only; never commit values):

| Variable | Required | Notes |
|----------|----------|-------|
| `ENVIRONMENT` | Yes | `production` |
| `DATABASE_URL` | Yes | Supabase pooled URL (`postgresql+psycopg://…:6543/…?sslmode=require`) |
| `JWT_SECRET_KEY` | Yes | ≥ 32 chars; generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `JWT_ALGORITHM` | Yes | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Yes | `1440` |
| `GEMINI_API_KEY` | Optional | Enables Gemini; empty uses the deterministic fallback |
| `GEMINI_MODEL` | Yes | `gemini-2.5-flash` |
| `FRONTEND_URL` | Yes | Vercel production URL, e.g. `https://citihelp.vercel.app` |
| `ADMIN_BOOTSTRAP_EMAIL` | Yes | Production admin email |
| `ADMIN_BOOTSTRAP_PASSWORD` | Yes | Strong, unique; do **not** reuse the development password |
| `ADMIN_BOOTSTRAP_NAME` | Yes | Display name |
| `UPLOAD_DIR` | Yes | `uploads` |

Optional: `CORS_ORIGINS`, `MAX_UPLOAD_SIZE_MB`.

The production guard rejects SQLite and a short JWT secret, so a
misconfigured deployment fails at startup instead of running insecurely.

### Frontend (Vercel)

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_BASE_URL` | Yes | `https://<backend-host>/api/v1` |

Never put `GEMINI_API_KEY`, `DATABASE_URL`, `JWT_SECRET_KEY` or admin
credentials in Vercel. Vite variables are embedded in the browser bundle.

---

## 7. Step 4 — Deploy the frontend on Vercel

1. Sign in at <https://vercel.com/new> (or run `vercel login`).
2. Import `bhargavarma/CitiHelp`.
3. Set **Root Directory** to `frontend`. Vercel detects Vite from
   `frontend/vercel.json`:
   - build `npm run build`
   - output `dist`
   - SPA rewrite to `index.html`
4. Add `VITE_API_BASE_URL` for Production (and Preview if desired).
5. Deploy.

CLI alternative:

```powershell
cd frontend
vercel login
vercel --prod
```

After the first deploy, copy the production URL into Render's `FRONTEND_URL`
and redeploy/restart the backend so CORS includes it.

---

## 8. Step 5 — Connect and verify

1. Confirm Render's `FRONTEND_URL` equals the Vercel production origin exactly
   (scheme + host, no trailing slash).
2. Confirm Vercel's `VITE_API_BASE_URL` points at the Render backend.
3. Redeploy the frontend if the backend URL changed, because Vite inlines the
   value at build time.

### Backend smoke tests

```powershell
$api = "https://<backend-host>/api/v1"

Invoke-RestMethod "$api/health"
Invoke-RestMethod "$api/services?page_size=1"
```

Then, through the deployed frontend:

1. Register a new citizen and sign in.
2. Submit a grievance with an attachment; note the reference number.
3. Refresh the page and sign in again — the grievance must still be listed.
4. Open the grievance detail and confirm the history entry.
5. Ask the AI assistant a supported question (grounded sources) and an
   unrelated question ("no verified information").
6. Sign in as the administrator and confirm the dashboard counts, the new
   grievance, and a status update with history.
7. Confirm a citizen cannot open `/admin` or another citizen's grievance.

### Database persistence check

After step 3, query Supabase (SQL editor) or re-run the backend health check.
The grievance must be present in PostgreSQL, not only in the browser.

---

## 9. Admin Setup

The administrator is created automatically at startup when
`ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are set. The bootstrap:

- creates the account only if it does not exist
- never resets an existing admin password
- never promotes an existing citizen account
- reads credentials only from the environment

To create or repair the admin manually:

```powershell
cd backend
.\.venv\Scripts\python.exe -m scripts.create_admin --email <email> --password "<strong-password>"
```

Run this against production only with `DATABASE_URL` pointing at Supabase.

---

## 10. Rollback and Safety

- **Never** run `alembic downgrade base` against production.
- The migration and copy scripts never drop tables or delete rows.
- To roll back an application release, redeploy the previous Render/Vercel
  build; the database stays intact.
- Keep the Supabase database password and JWT secret in a password manager.

---

## 11. Known Limitations

- Render's free plan sleeps after inactivity; the first request is slow.
- Render's free plan has an ephemeral filesystem, so uploaded attachments are
  lost on redeploy. Use a persistent disk (paid) or object storage for durable
  uploads.
- Supabase free tier may pause inactive projects; wake it before a demo.
- Live Gemini usage depends on quota and a valid key.
