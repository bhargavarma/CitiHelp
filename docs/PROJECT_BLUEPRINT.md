# PROJECT BLUEPRINT — Public Grievance AI Assistant

> **Project ID:** HACK-P438  
> **Category:** Government and Public Services  
> **Type:** Full-stack Web Application  
> **Team Size:** 4  
> **Last Updated:** 2026-10-30

---

## 1. Project Overview

The Public Grievance AI Assistant is a centralized citizen-facing web platform that helps citizens navigate public services, get AI-powered assistance, submit grievances, and track their resolution.

### Core Value Proposition

| Problem | Solution |
|---------|----------|
| Citizens don't know which department handles their issue | AI assistant identifies the right department using a curated knowledge base |
| Finding required documents is confusing | Service directory lists eligibility, documents, and procedures per service |
| No easy way to submit and track complaints | Guided grievance submission with unique reference numbers and status tracking |
| Government staff lack a unified complaints view | Admin dashboard with filters, analytics, and status management |

### Prototype Disclaimer

> [!CAUTION]
> This is an academic prototype. All public-service information is synthetic or sourced from publicly available samples. Grievances are **not** forwarded to any real government department. All records are prototype data only.

---

## 2. Users and Roles

### 2.1 Citizen

| Attribute | Details |
|-----------|---------|
| Registration | Self-service via public registration form |
| Authentication | Email + password → JWT |
| Default role | `citizen` (assigned automatically; never selectable) |
| Data access | Own grievances only |

### 2.2 Admin

| Attribute | Details |
|-----------|---------|
| Registration | Created via secure database seed script (never via public registration) |
| Authentication | Email + password → JWT (same auth flow, different role) |
| Default role | `admin` (assigned only by seed script or superadmin) |
| Data access | All grievances across all citizens |

### 2.3 Unauthenticated Visitor

| Capability | Access |
|------------|--------|
| View landing page | ✅ |
| Browse public service directory | ✅ |
| View service details | ✅ |
| Register / Login | ✅ |
| Submit grievances | ❌ |
| Use AI assistant | ❌ |
| Access dashboards | ❌ |

---

## 3. Complete Functional Requirements

### Module A — Authentication & Authorization

| ID | Requirement | Priority |
|----|------------|----------|
| A-01 | Citizen self-registration with email, full name, phone, password | Must |
| A-02 | Email uniqueness validation | Must |
| A-03 | Password hashing with Argon2 | Must |
| A-04 | Login returning JWT access token | Must |
| A-05 | JWT verification on all protected routes | Must |
| A-06 | Role-based authorization (citizen vs admin) | Must |
| A-07 | `GET /auth/me` — return current user profile | Must |
| A-08 | Logout (client-side token removal) | Must |
| A-09 | Password strength validation (min 8 chars, mixed) | Must |
| A-10 | Token expiry handling (frontend redirect to login) | Must |
| A-11 | Admin seed script (creates admin from env vars) | Must |
| A-12 | Prevent role escalation via registration | Must |

### Module B — Public Service Directory

| ID | Requirement | Priority |
|----|------------|----------|
| B-01 | Seed database with ≥15 sample services | Must |
| B-02 | List all services with pagination | Must |
| B-03 | Search services by name/keyword | Must |
| B-04 | Filter services by category | Must |
| B-05 | View service detail page | Must |
| B-06 | Display eligibility, documents, procedure | Must |
| B-07 | Display source URL and last-reviewed date | Must |
| B-08 | Label unverified/sample data clearly | Must |

### Module C — Grievance Submission

| ID | Requirement | Priority |
|----|------------|----------|
| C-01 | Submit grievance (subject, description, category, location) | Must |
| C-02 | Optional file attachment (image/PDF, ≤5 MB) | Must |
| C-03 | Generate unique reference number (e.g., `GRV-20261030-XXXX`) | Must |
| C-04 | Set initial status to `submitted` | Must |
| C-05 | Create initial history record | Must |
| C-06 | Return confirmation with reference number | Must |
| C-07 | Backend validation of all fields | Must |
| C-08 | Prevent duplicate submissions (debounce) | Should |
| C-09 | Ownership: grievance linked to authenticated user | Must |

### Module D — Grievance Tracking

| ID | Requirement | Priority |
|----|------------|----------|
| D-01 | Citizen: list own grievances | Must |
| D-02 | Citizen: view grievance detail | Must |
| D-03 | Citizen: view status history timeline | Must |
| D-04 | Citizen: search by reference number | Must |
| D-05 | Display admin remarks to citizen | Must |
| D-06 | Status values: submitted, under_review, in_progress, resolved, rejected | Must |
| D-07 | Ownership check — citizen cannot view another's grievance | Must |

### Module E — Admin Dashboard

| ID | Requirement | Priority |
|----|------------|----------|
| E-01 | View total, pending, in-progress, resolved grievance counts | Must |
| E-02 | View category-wise distribution | Must |
| E-03 | List all grievances with pagination | Must |
| E-04 | Filter by status, category, date range | Must |
| E-05 | Search grievances by reference number or keyword | Must |
| E-06 | View grievance detail | Must |
| E-07 | Update grievance status | Must |
| E-08 | Add administrative remark on status change | Must |
| E-09 | Each status update creates a history record | Must |
| E-10 | Prevent non-admin from accessing these endpoints | Must |

### Module F — AI Assistant

| ID | Requirement | Priority |
|----|------------|----------|
| F-01 | Chat interface with conversation history | Must |
| F-02 | PostgreSQL full-text search on knowledge_documents | Must |
| F-03 | Retrieve top-k relevant documents | Must |
| F-04 | Construct prompt with retrieved context | Must |
| F-05 | Call Gemini API server-side | Must |
| F-06 | Return answer with source references | Must |
| F-07 | Return "I don't have sufficient information" when no docs match | Must |
| F-08 | Store chat session and messages | Must |
| F-09 | Display document review dates | Must |
| F-10 | Label all AI answers as AI-generated | Must |
| F-11 | Never expose Gemini API key to frontend | Must |

### Module G — Multilingual Support

| ID | Requirement | Priority |
|----|------------|----------|
| G-01 | All UI strings externalized into i18n resource files | Should |
| G-02 | English as default language | Must |
| G-03 | Architecture supports adding Telugu locale | Should |
| G-04 | Language selector in header (prepared, English-only initially) | Should |

---

## 4. User Journeys

### Journey 1 — New Citizen Registration and First Grievance

```
1. Visitor lands on home page
2. Clicks "Register"
3. Fills registration form (name, email, phone, password)
4. System validates, creates account, redirects to login
5. Citizen logs in → receives JWT → redirected to citizen dashboard
6. Citizen clicks "Submit Grievance"
7. Fills grievance form (subject, description, category, location)
8. Optionally attaches a document
9. Submits → receives confirmation with reference number GRV-XXXXXXXX-XXXX
10. Navigates to "My Grievances" → sees the new grievance with status "Submitted"
```

### Journey 2 — Citizen Uses AI Assistant

```
1. Citizen logs in
2. Clicks "AI Assistant" in navigation
3. Types: "How do I apply for a birth certificate?"
4. Backend searches knowledge_documents via full-text search
5. Top-k documents retrieved and passed as context to Gemini
6. AI generates answer with source references
7. Response displayed with "AI-Generated" label and source links
8. Citizen asks a follow-up question in same session
```

### Journey 3 — Citizen Tracks Grievance

```
1. Citizen logs in
2. Navigates to "My Grievances"
3. Sees list of own grievances with current status
4. Clicks on a grievance → sees full details
5. Views status history timeline:
   - Submitted → Under Review → In Progress
6. Reads admin remark: "Forwarded to water supply department"
```

### Journey 4 — Admin Reviews and Updates Grievance

```
1. Admin logs in (same login page, role detected from JWT)
2. Redirected to admin dashboard
3. Sees analytics: total complaints, pending count, category chart
4. Clicks "Grievance Management"
5. Filters by status "Submitted" to see new complaints
6. Opens a grievance → reads details
7. Changes status to "Under Review"
8. Adds remark: "Assigned to sanitation department for inspection"
9. System creates history record with timestamp and admin ID
10. Citizen sees updated status on their tracking page
```

### Journey 5 — Visitor Browses Service Directory

```
1. Visitor (unauthenticated) opens the platform
2. Clicks "Services" in navigation
3. Sees paginated list of public services
4. Filters by category "Health"
5. Clicks "Primary Health Center Registration"
6. Sees full detail: description, eligibility, required documents, procedure
7. Notes "(Sample data — not verified)" label
```

---

## 5. Scope and Limitations

### In Scope

- Complete authentication with JWT + Argon2
- Public service directory with 15+ seeded entries
- Grievance CRUD with reference numbers and status tracking
- Admin dashboard with real-time analytics from database
- AI assistant with RAG using PostgreSQL full-text search + Gemini
- Responsive frontend with professional civic design
- Deployable on Vercel (frontend) + Render (backend) + Supabase (DB)

### Out of Scope

- Real government integration or data submission
- Email/SMS notifications (could be a future enhancement)
- Payment processing
- OAuth/social login
- Real-time WebSocket updates
- Mobile native application
- Telugu translation (architecture prepared, not implemented)
- Multi-tenant support
- Document OCR or automated classification
- Rate limiting (noted for production but not implemented in prototype)

### Known Limitations

| Limitation | Mitigation |
|------------|------------|
| All service data is synthetic | Clearly labeled as sample data |
| AI answers based on curated knowledge base only | System refuses to answer if no matching documents found |
| Single admin role (no role hierarchy) | Sufficient for prototype scope |
| No email verification on registration | Noted as future enhancement |
| File uploads stored locally or in-memory for prototype | Production would use object storage |
| No refresh token rotation | Access token expiry set to reasonable duration |

---

## 6. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| All modules functional | Each API endpoint returns correct responses |
| Authentication secure | Passwords hashed, JWTs validated, roles enforced |
| Data persists | All operations write to and read from PostgreSQL |
| AI provides sourced answers | Responses include document references |
| UI professional and responsive | Works on desktop and mobile viewports |
| Deployable | Live on Vercel + Render + Supabase |
| Testable | Pytest suite passes; Postman collection documented |
