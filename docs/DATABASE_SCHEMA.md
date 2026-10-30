# DATABASE SCHEMA — Public Grievance AI Assistant

> **Project ID:** HACK-P438
> **Database:** PostgreSQL 15 (Supabase)
> **ORM:** SQLAlchemy 2.0 (synchronous)
> **Migrations:** Alembic — revision `0001_initial_schema`
> **Local/test fallback:** SQLite
> **Last Updated:** 2026-10-31

This document reflects the schema actually created by
`backend/alembic/versions/0001_initial_schema.py` and declared in
`backend/app/models/`.

---

## 1. Conventions

- **Primary keys:** `String(36)` holding a UUID4 string generated in Python
  (`default=lambda: str(uuid.uuid4())`). PostgreSQL `UUID`/`JSONB` column types
  are **not** used.
- **Timestamps:** every table has `created_at` and `updated_at`
  (`DateTime(timezone=True)`, `server_default = CURRENT_TIMESTAMP`;
  `updated_at` is also refreshed by the ORM `onupdate`).
- **JSON:** `services.required_documents` and `chat_messages.sources` use the
  generic `JSON` type (portable between PostgreSQL and SQLite).
- **Statuses** are stored as human-readable strings with spaces and title case:
  `Submitted`, `Under Review`, `In Progress`, `Resolved`, `Rejected`.
- **Deletes:** grievances and chat sessions cascade from `users`; history and
  messages cascade from their parents; `grievance_history.changed_by` is set to
  `NULL` when the acting user is deleted.

---

## 2. Entity Relationship Diagram

```
┌──────────────────────┐
│        users         │
│──────────────────────│
│ id            PK     │
│ email         UNIQUE │
│ full_name            │
│ phone                │
│ password_hash        │
│ role                 │
│ is_active            │
│ created_at           │
│ updated_at           │
└───┬───────────┬──────┘
    │ 1:N       │ 1:N
    │           │
    ▼           ▼
┌──────────────────────┐        ┌──────────────────────────┐
│      grievances      │        │       chat_sessions      │
│──────────────────────│        │──────────────────────────│
│ id            PK     │        │ id            PK         │
│ user_id       FK     │        │ user_id       FK         │
│ reference_number UNIQ│        │ title                    │
│ subject              │        │ created_at / updated_at  │
│ description          │        └────────────┬─────────────┘
│ category             │                     │ 1:N
│ location             │                     ▼
│ attachment_path      │        ┌──────────────────────────┐
│ current_status       │        │       chat_messages      │
│ created_at/updated_at│        │──────────────────────────│
└──────────┬───────────┘        │ id            PK         │
           │ 1:N                │ session_id    FK         │
           ▼                    │ role                     │
┌──────────────────────┐        │ content                  │
│  grievance_history   │        │ sources       JSON       │
│──────────────────────│        │ created_at / updated_at  │
│ id            PK     │        └──────────────────────────┘
│ grievance_id  FK     │
│ changed_by    FK     │        ┌──────────────────────────┐
│ old_status           │        │   knowledge_documents    │
│ new_status           │        │──────────────────────────│
│ remarks              │        │ id            PK         │
│ created_at/updated_at│        │ title                    │
└──────────────────────┘        │ content                  │
                                │ category                 │
┌──────────────────────┐        │ department               │
│       services       │        │ source_url               │
│──────────────────────│        │ last_reviewed            │
│ id            PK     │        │ created_at / updated_at  │
│ name                 │        └──────────────────────────┘
│ category             │
│ department           │        services and knowledge_documents
│ description          │        have no foreign keys; they are
│ eligibility          │        curated reference tables used by
│ required_documents   │        the directory and the AI assistant.
│ procedure            │
│ source_url           │
│ last_reviewed        │
│ is_verified          │
│ created_at/updated_at│
└──────────────────────┘
```

---

## 3. Tables

### 3.1 `users`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `String(36)` | no | UUID4 | Primary key |
| `email` | `String(255)` | no | — | Unique, indexed; stored lower-case |
| `full_name` | `String(255)` | no | — | 2–255 chars at the API layer |
| `phone` | `String(20)` | yes | `NULL` | Optional |
| `password_hash` | `String(512)` | no | — | Argon2 hash |
| `role` | `String(20)` | no | `citizen` | Indexed |
| `is_active` | `Boolean` | no | `true` | Deactivated users get 403 |
| `created_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |

Constraints / indexes:

- `ck_users_role`: `role IN ('citizen', 'admin')`
- `ix_users_email` — unique
- `ix_users_role` — non-unique

Relationships: one user → many `grievances`, many `chat_sessions`, many
`grievance_history` rows as `changer`.

---

### 3.2 `services`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `String(36)` | no | UUID4 | Primary key |
| `name` | `String(255)` | no | — | Indexed |
| `category` | `String(100)` | no | — | Indexed |
| `department` | `String(255)` | no | — | |
| `description` | `Text` | no | — | |
| `eligibility` | `Text` | no | — | |
| `required_documents` | `JSON` | no | `[]` | Array of strings |
| `procedure` | `Text` | no | — | |
| `source_url` | `String(500)` | yes | `NULL` | Official reference |
| `last_reviewed` | `String(50)` | no | — | ISO date string |
| `is_verified` | `Boolean` | no | `false` | Seeded rows use `true` |
| `created_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |

Indexes: `ix_services_name`, `ix_services_category`.

Seeded with **16** services across Civil Registration, Municipal Services,
Revenue & Property, Civil Supplies, Transport, Energy & Utilities, Commerce &
Municipal, Social Welfare, Social Welfare & Health, and more.

---

### 3.3 `grievances`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `String(36)` | no | UUID4 | Primary key |
| `user_id` | `String(36)` | no | — | FK → `users.id`, `ON DELETE CASCADE`, indexed |
| `reference_number` | `String(50)` | no | — | Unique, indexed; format `GRV-YYYYMMDD-XXXX` |
| `subject` | `String(255)` | no | — | 5–255 chars |
| `description` | `Text` | no | — | 15–5000 chars |
| `category` | `String(100)` | no | — | Must match the allowed list |
| `location` | `String(255)` | no | — | 3–255 chars |
| `attachment_path` | `String(500)` | yes | `NULL` | Must match `^/uploads/[A-Za-z0-9_.-]+$` |
| `current_status` | `String(50)` | no | `Submitted` | Indexed |
| `created_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |

Constraints / indexes:

- `ck_grievances_current_status`:
  `current_status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected')`
- `ix_grievances_user_id`
- `ix_grievances_reference_number` — unique
- `ix_grievances_category`
- `ix_grievances_current_status`

Allowed categories (API constant `GRIEVANCE_CATEGORIES`):

1. Municipal Services
2. Water Supply & Sanitation
3. Roads & Infrastructure
4. Energy & Utilities
5. Civil Supplies & Ration
6. Revenue & Property
7. Transport & Traffic
8. Social Welfare & Pensions
9. Public Health & Hospitals
10. Environmental & Pollution
11. General Public Administration

Category matching is case-insensitive and normalised to the canonical spelling.

---

### 3.4 `grievance_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `String(36)` | no | UUID4 | Primary key |
| `grievance_id` | `String(36)` | no | — | FK → `grievances.id`, `ON DELETE CASCADE`, indexed |
| `changed_by` | `String(36)` | yes | `NULL` | FK → `users.id`, `ON DELETE SET NULL` |
| `old_status` | `String(50)` | yes | `NULL` | `NULL` for the initial record |
| `new_status` | `String(50)` | no | — | Must be a valid status |
| `remarks` | `Text` | yes | `NULL` | Officer remarks / system text |
| `created_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |

Constraints / indexes:

- `ck_grievance_history_new_status`:
  `new_status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected')`
- `ix_grievance_history_grievance_id`

Every status transition inserts one row. The initial `Submitted` row is written
in the same transaction as grievance creation, so history is never empty.
Rows are append-only: an update inserts a new record and never rewrites or
deletes earlier transitions.

New rows receive a Python-side UTC timestamp with microsecond precision (the
schema default remains `CURRENT_TIMESTAMP` for compatibility), so several
updates in the same second keep a deterministic chronological order in the
admin audit feed and history timeline.

---

### 3.5 `knowledge_documents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `String(36)` | no | UUID4 | Primary key |
| `title` | `String(255)` | no | — | Indexed |
| `content` | `Text` | no | — | Curated answer text |
| `category` | `String(100)` | no | — | Indexed |
| `department` | `String(255)` | yes | `NULL` | |
| `source_url` | `String(500)` | yes | `NULL` | Official reference |
| `last_reviewed` | `String(50)` | no | — | ISO date string |
| `created_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |

Indexes: `ix_knowledge_documents_title`, `ix_knowledge_documents_category`.

Seeded with **20** documents covering portal guidance, citizen charter topics,
civil registration, transport, sanitation, welfare and emergency categories.
No `search_vector` / `tsvector` column exists; retrieval uses `ILIKE`.

---

### 3.6 `chat_sessions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `String(36)` | no | UUID4 | Primary key |
| `user_id` | `String(36)` | no | — | FK → `users.id`, `ON DELETE CASCADE`, indexed |
| `title` | `String(255)` | yes | `NULL` | Auto-generated from the first question |
| `created_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |

Index: `ix_chat_sessions_user_id`.

Sessions are private: only the owning user can list, read or post messages.

---

### 3.7 `chat_messages`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `String(36)` | no | UUID4 | Primary key |
| `session_id` | `String(36)` | no | — | FK → `chat_sessions.id`, `ON DELETE CASCADE`, indexed |
| `role` | `String(20)` | no | — | `user` or `assistant` |
| `content` | `Text` | no | — | Question or grounded answer |
| `sources` | `JSON` | yes | `[]` | Array of `{title, source_url, last_reviewed, relevance_type}` |
| `created_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DateTime(tz)` | no | `CURRENT_TIMESTAMP` | |

Constraints / indexes:

- `ck_chat_messages_role`: `role IN ('user', 'assistant')`
- `ix_chat_messages_session_id`

Sources stored here are exactly the curated rows used to ground the answer.

---

## 4. Migration

The initial revision creates all seven tables, foreign keys, check constraints
and indexes, and includes a full `downgrade()`.

```bash
cd backend

# Apply the schema
.venv/Scripts/python.exe -m alembic upgrade head

# Inspect the current revision
.venv/Scripts/python.exe -m alembic current

# Roll everything back (development only)
.venv/Scripts/python.exe -m alembic downgrade base
```

On macOS/Linux use `.venv/bin/python -m alembic ...`.

Notes:

- `alembic/env.py` is synchronous and reads `DATABASE_URL` through
  `app.database.session.get_database_url()`, so the same value used by the app
  drives migrations.
- The application lifespan also calls `Base.metadata.create_all`, which is why
  a fresh local SQLite file works even before running Alembic. Production
  deployments should still run `alembic upgrade head`.
- The revision was verified end-to-end against a clean SQLite database. It has
  **not** been executed against the target Supabase PostgreSQL instance in this
  environment (no credentials available).

---

## 5. Seed Data

| Data | Count | Source |
|------|-------|--------|
| Public services | 16 | `SERVICES_DATA` in `app/database/seed.py` |
| Knowledge documents | 20 | `KNOWLEDGE_DOCS_DATA` in `app/database/seed.py` |
| Administrator | 0 or 1 | Only when `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` are set |

Seeding is idempotent: services are matched by `name`, knowledge documents by
`title`, and the administrator by `email`.

Administrator bootstrap safety:

- An admin account is created only when no user with that email exists.
- An existing administrator is preserved; its password is **not** reset.
- If the email belongs to an existing citizen, bootstrap logs an error and
  refuses to promote the account. Use a different administrator email.

The admin dashboard and audit workflow reuse the existing seven tables; no
additional tables or migrations are required for them.

Commands:

```bash
cd backend
.venv/Scripts/python.exe -m scripts.seed_data
.venv/Scripts/python.exe -m scripts.create_admin --email admin@example.gov.in --password "StrongPass123"
```

---

## 6. Useful Queries

```sql
-- Status distribution for the admin dashboard
SELECT current_status, COUNT(*) FROM grievances GROUP BY current_status;

-- Full audit trail for one grievance
SELECT old_status, new_status, remarks, created_at
FROM grievance_history
WHERE grievance_id = '<grievance-id>'
ORDER BY created_at;

-- Services with no official URL (data-quality check)
SELECT name FROM services WHERE source_url IS NULL;

-- Chat messages that returned no grounded source
SELECT id, content FROM chat_messages
WHERE role = 'assistant' AND (sources IS NULL OR sources::text = '[]');
```
