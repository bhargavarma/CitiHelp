# SECURITY PLAN — Public Grievance AI Assistant

> **Project ID:** HACK-P438  
> **Last Updated:** 2026-10-30

---

## 1. Authentication Security

### 1.1 Password Hashing

| Property | Value |
|----------|-------|
| Algorithm | Argon2id |
| Library | argon2-cffi |
| Time cost | 3 iterations |
| Memory cost | 65536 KiB (64 MB) |
| Parallelism | 4 |
| Hash length | 32 bytes |
| Salt | Auto-generated (16 bytes) |

**Implementation:**
```python
from argon2 import PasswordHasher

ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
)

# Hash
hash = ph.hash(password)

# Verify
ph.verify(hash, password)
```

**Rules:**
- Never store passwords in plaintext
- Never log password values
- Never return password hashes in API responses
- Use `ph.check_needs_rehash()` to upgrade hashes if parameters change

---

### 1.2 JWT Tokens

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| Library | PyJWT |
| Expiry | 24 hours |
| Signing key | `JWT_SECRET_KEY` env var (≥32 random characters) |

**Token Payload:**
```json
{
  "sub": "user-uuid",
  "role": "citizen",
  "exp": 1730000000,
  "iat": 1729913600
}
```

**Rules:**
- Never include passwords or sensitive data in JWT payload
- Always validate `exp` claim
- Always validate `sub` exists in database (user not deleted/deactivated)
- Use `secrets.token_urlsafe(32)` to generate JWT_SECRET_KEY
- Never hardcode the secret key

---

### 1.3 Token Handling

| Concern | Mitigation |
|---------|-----------|
| Storage (frontend) | localStorage (acceptable for prototype; HttpOnly cookies for production) |
| Transmission | Always via `Authorization: Bearer <token>` header |
| Expiry | 24-hour expiry; frontend redirects to login on 401 |
| Revocation | Not implemented in prototype (noted as limitation) |
| Refresh tokens | Not implemented in prototype (single access token) |

---

## 2. Authorization Security

### 2.1 Role-Based Access Control

```
┌──────────────────────────────────────────────────────┐
│                    FastAPI Dependencies               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  get_current_user(token) → User                     │
│       │                                              │
│       ├── require_citizen(user) → User (role check)  │
│       │                                              │
│       └── require_admin(user) → User (role check)    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Rules:**
| Rule | Enforcement Location |
|------|---------------------|
| Citizens cannot access admin endpoints | `require_admin` dependency on all `/admin/*` routes |
| Citizens see only own grievances | `WHERE user_id = current_user.id` in SQL query |
| Citizens see only own chat sessions | `WHERE user_id = current_user.id` in SQL query |
| Registration never accepts role parameter | Schema ignores `role` field; hardcoded to `citizen` |
| Admin creation only via seed script | No API endpoint to create admin users |

### 2.2 Ownership Verification

```python
# ALWAYS verify ownership server-side
async def get_citizen_grievance(grievance_id: UUID, current_user: User, db: AsyncSession):
    grievance = await db.get(Grievance, grievance_id)
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    if grievance.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return grievance
```

### 2.3 Admin Account Bootstrap

```bash
# Secure admin creation (never in source code)
# Environment variables on deployment platform:
ADMIN_EMAIL=<set-in-environment>
ADMIN_PASSWORD=<set-in-environment>
ADMIN_FULL_NAME=<set-in-environment>

# Seed script checks if admin exists, creates if not
# Password is hashed with Argon2 before storage
# Script is idempotent (safe to run multiple times)
```

---

## 3. Input Validation

### 3.1 Backend Validation (Pydantic v2)

| Field | Validation |
|-------|-----------|
| Email | Valid email format (Pydantic `EmailStr`) |
| Password | Min 8 chars, 1 uppercase, 1 lowercase, 1 digit |
| Full name | 2–255 characters, stripped |
| Phone | 10–20 characters, optional |
| Subject | 5–255 characters |
| Description | 20–5000 characters |
| Category | Must match enum list |
| Location | 3–255 characters |
| Status | Must match status enum |
| Remarks | Max 2000 characters |
| Chat message | 1–2000 characters |
| Pagination: page | ≥1 |
| Pagination: page_size | 1–50 |

### 3.2 Frontend Validation (Zod + React Hook Form)

- Mirror all backend validation rules in Zod schemas
- Show field-level validation errors before submission
- Disable submit button while form is invalid
- **Never rely on frontend validation alone** — backend always validates independently

### 3.3 SQL Injection Prevention

- All queries through SQLAlchemy ORM (parameterized)
- Never use raw SQL string concatenation
- Full-text search uses `plainto_tsquery()` (safe parameterized function)

---

## 4. Secret Management

### 4.1 Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Backend | JWT signing secret |
| `GEMINI_API_KEY` | Backend | Google Gemini API key |
| `CORS_ORIGINS` | Backend | Allowed frontend origins (comma-separated) |
| `ADMIN_EMAIL` | Backend (seed) | Initial admin email |
| `ADMIN_PASSWORD` | Backend (seed) | Initial admin password |
| `ADMIN_FULL_NAME` | Backend (seed) | Initial admin name |
| `VITE_API_BASE_URL` | Frontend | Backend API URL |

### 4.2 .env Management

```
# .env.example (committed to git — NO secrets)
DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
JWT_SECRET_KEY=your-secret-key-here-generate-with-openssl
GEMINI_API_KEY=your-gemini-api-key
CORS_ORIGINS=http://localhost:5173
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
ADMIN_FULL_NAME=System Administrator
```

**Rules:**
- `.env` is in `.gitignore` — never committed
- `.env.example` contains placeholder values only
- Secrets set via deployment platform environment variables
- Never print/log secrets

### 4.3 .gitignore

```
# Secrets
.env
.env.local
.env.production

# Python
__pycache__/
*.pyc
.venv/

# Node
node_modules/
dist/

# Uploads
uploads/

# IDE
.vscode/
.idea/
```

---

## 5. File Upload Security

### 5.1 Validation Rules

| Rule | Value |
|------|-------|
| Max file size | 5 MB |
| Allowed MIME types | `image/jpeg`, `image/png`, `application/pdf` |
| Allowed extensions | `.jpg`, `.jpeg`, `.png`, `.pdf` |
| Filename sanitization | UUID-based rename (discard original name) |

### 5.2 Implementation

```python
ALLOWED_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB

async def validate_upload(file: UploadFile):
    # Check MIME type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Unsupported file type")

    # Check file size (read in chunks)
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "File too large (max 5 MB)")

    # Generate safe filename
    ext = Path(file.filename).suffix.lower()
    safe_name = f"{uuid4()}{ext}"

    await file.seek(0)
    return safe_name, content
```

### 5.3 Storage

| Environment | Strategy |
|-------------|---------|
| Development | Local filesystem (`uploads/` directory) |
| Production (prototype) | Local filesystem on Render |
| Production (ideal) | Object storage (S3/GCS) — noted as future enhancement |

---

## 6. API Security

### 6.1 CORS Configuration

```python
CORSMiddleware(
    allow_origins=[
        "http://localhost:5173",           # Local dev
        "https://your-app.vercel.app",     # Production
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

**Rules:**
- Never use `allow_origins=["*"]` with credentials
- Origins loaded from `CORS_ORIGINS` environment variable
- Update when deployment URL changes

### 6.2 Error Handling

| Principle | Implementation |
|-----------|---------------|
| No stack traces in responses | Exception handler catches all unhandled errors → generic 500 |
| No internal details exposed | Error messages are user-facing; details logged server-side |
| Consistent error format | All errors return `{"detail": "message"}` |

### 6.3 Request Logging

```python
# Log: method, path, status, duration
logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)")

# NEVER log:
# - request.headers["Authorization"]
# - request body containing passwords
# - response body containing tokens
# - any env var values
```

---

## 7. Data Protection

### 7.1 Sensitive Data Handling

| Data | Protection |
|------|-----------|
| Passwords | Argon2 hashed; never stored in plaintext |
| JWT tokens | Signed, expiring; not stored server-side |
| User PII (name, email, phone) | Stored in DB; not logged |
| Gemini API key | Backend env var only; never exposed to frontend |
| Admin credentials | Env vars only; never in source code |
| Grievance descriptions | Stored in DB; access controlled by ownership/role |

### 7.2 Database Security

| Measure | Implementation |
|---------|---------------|
| Connection encryption | SSL/TLS to Supabase (enforced by connection string) |
| Connection string | Stored in environment variable only |
| Access control | Application-level (JWT + role checks) |
| Cascading deletes | Configured in foreign keys |

---

## 8. Security Checklist

Use this checklist before each deployment:

- [ ] `.env` file is in `.gitignore`
- [ ] No secrets in source code (grep for `password`, `secret`, `key`, `token`)
- [ ] All protected endpoints require authentication
- [ ] Admin endpoints require admin role
- [ ] Citizen grievance endpoints check ownership
- [ ] Chat session endpoints check ownership
- [ ] Registration endpoint ignores `role` field
- [ ] Passwords hashed with Argon2
- [ ] JWT tokens expire
- [ ] JWT_SECRET_KEY is ≥32 characters
- [ ] CORS allows only known origins
- [ ] File uploads validate type and size
- [ ] File uploads use UUID filenames
- [ ] Gemini API key not in frontend code
- [ ] No stack traces in production error responses
- [ ] No passwords/tokens in logs
- [ ] SQL queries use parameterized ORM
- [ ] Pydantic validates all incoming data
- [ ] Admin account created only via seed script

---

## 9. Known Security Limitations (Prototype)

| Limitation | Risk Level | Mitigation for Production |
|------------|-----------|--------------------------|
| No refresh token rotation | Medium | Implement refresh tokens with rotation |
| No rate limiting | Medium | Add rate limiting middleware (slowapi) |
| JWT in localStorage | Low-Medium | Use HttpOnly cookies |
| No email verification | Low | Add email verification flow |
| No CSRF protection | Low | Add CSRF tokens for cookie-based auth |
| No account lockout | Low | Lock account after N failed attempts |
| File stored on local disk | Low | Use object storage with signed URLs |
| No audit trail for admin actions | Low | Add comprehensive audit logging |

> [!IMPORTANT]
> These limitations are acceptable for an academic prototype but should be addressed before any real-world deployment.
