# DEVELOPMENT PLAN — Public Grievance AI Assistant

> **Project ID:** HACK-P438  
> **Last Updated:** 2026-10-30

---

## 1. Phase Overview

```
Phase 0  ──→  Phase 1  ──→  Phase 2  ──→  Phase 3  ──→  Phase 4
Planning      Scaffold      Database      Auth           Services
                                │
                                ▼
Phase 5  ──→  Phase 6  ──→  Phase 7  ──→  Phase 8  ──→  Phase 9
Grievance     Tracking       Admin        AI/RAG        Integration
Submit                       Dashboard
                                                            │
                                                            ▼
                                                  Phase 10  ──→  Phase 11
                                                  Testing        Deployment
                                                  Security       Documentation
```

---

## 2. Phase Details

### Phase 0 — Architecture and Planning ✅

**Status:** Current phase

**Deliverables:**
- [x] PROJECT_BLUEPRINT.md
- [x] ARCHITECTURE.md
- [x] DATABASE_SCHEMA.md
- [x] API_SPECIFICATION.md
- [x] DEVELOPMENT_PLAN.md
- [x] SECURITY_PLAN.md

**Exit Criteria:**
- All documents reviewed and approved
- No unresolved architectural decisions

---

### Phase 1 — Project Scaffolding

**Dependencies:** Phase 0 approved

**Backend Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 1.1 | Initialize Python project with pyproject.toml | Project structure created |
| 1.2 | Install dependencies (FastAPI, SQLAlchemy, etc.) | requirements.txt generated |
| 1.3 | Create FastAPI app entry point | `uvicorn app.main:app` starts successfully |
| 1.4 | Set up project directory structure | All folders from architecture created |
| 1.5 | Create .env.example | All required env vars listed |
| 1.6 | Create config.py (reads from env) | Settings load without error |
| 1.7 | Set up CORS middleware | Frontend origin allowed |
| 1.8 | Create health check endpoint | `GET /api/v1/health` returns 200 |

**Frontend Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 1.9 | Initialize Vite + React + TypeScript project | `pnpm dev` starts dev server |
| 1.10 | Install dependencies (Tailwind, shadcn/ui, etc.) | All packages in package.json |
| 1.11 | Configure Tailwind CSS | Utility classes work |
| 1.12 | Initialize shadcn/ui | Component CLI works |
| 1.13 | Set up directory structure | All folders from architecture created |
| 1.14 | Configure React Router with route structure | All routes render placeholder pages |
| 1.15 | Create base layout components | Header, Footer, Sidebar render |
| 1.16 | Set up Axios instance with interceptors | API calls reach backend |
| 1.17 | Create .env.example | VITE_API_BASE_URL listed |

**Verification:**
- Backend starts and returns health check
- Frontend starts and displays landing page placeholder
- Frontend can call backend health endpoint (CORS works)

---

### Phase 2 — Database and Migrations

**Dependencies:** Phase 1

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 2.1 | Configure SQLAlchemy async engine | Connection to Supabase PostgreSQL succeeds |
| 2.2 | Create async session factory | Sessions can be created and closed |
| 2.3 | Define SQLAlchemy Base model | Base with UUID PK, timestamps |
| 2.4 | Create User model | Model matches schema spec |
| 2.5 | Create Service model | Model matches schema spec |
| 2.6 | Create Grievance model | Model matches schema spec, FK to users |
| 2.7 | Create GrievanceHistory model | Model matches schema spec, FK to grievances & users |
| 2.8 | Create KnowledgeDocument model | Model with tsvector column |
| 2.9 | Create ChatSession model | Model matches schema spec, FK to users |
| 2.10 | Create ChatMessage model | Model matches schema spec, FK to chat_sessions |
| 2.11 | Initialize Alembic | alembic.ini configured |
| 2.12 | Generate initial migration | All 7 tables in migration |
| 2.13 | Run migration | Tables created in Supabase |
| 2.14 | Create full-text search trigger migration | search_vector auto-populates |
| 2.15 | Verify all tables in database | Query each table successfully |

**Verification:**
- `alembic upgrade head` succeeds
- All 7 tables exist with correct columns
- Foreign keys are enforced
- GIN index on search_vector exists

---

### Phase 3 — Authentication and Authorization

**Dependencies:** Phase 2 (User model + migrations)

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 3.1 | Implement Argon2 password hashing | Hash + verify functions work |
| 3.2 | Implement JWT creation | Token contains sub, role, exp |
| 3.3 | Implement JWT verification | Valid tokens decode; expired/invalid tokens reject |
| 3.4 | Create auth Pydantic schemas | RegisterRequest, LoginRequest, TokenResponse, UserResponse |
| 3.5 | Implement registration endpoint | Creates user, returns 201 |
| 3.6 | Handle duplicate email on registration | Returns 409 |
| 3.7 | Implement login endpoint | Returns JWT on valid credentials |
| 3.8 | Handle invalid credentials | Returns 401 |
| 3.9 | Implement `get_current_user` dependency | Extracts user from JWT |
| 3.10 | Implement `require_citizen` dependency | Returns 403 for non-citizen |
| 3.11 | Implement `require_admin` dependency | Returns 403 for non-admin |
| 3.12 | Implement GET /auth/me | Returns current user profile |
| 3.13 | Create admin seed script | Creates admin from ADMIN_EMAIL/ADMIN_PASSWORD env vars |
| 3.14 | Verify role cannot be set via registration | Registration always sets role='citizen' |
| 3.15 | Write pytest tests for auth | All auth flows tested |

**Frontend Auth Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 3.16 | Create AuthProvider context | Stores user + token |
| 3.17 | Build Login page | Form submits, token stored, redirect |
| 3.18 | Build Registration page | Form submits, redirects to login |
| 3.19 | Implement ProtectedRoute component | Redirects unauthenticated users |
| 3.20 | Configure Axios interceptor | Attaches Bearer token |
| 3.21 | Handle 401 responses | Clear token, redirect to login |
| 3.22 | Role-based routing | Citizens → /dashboard, admins → /admin |

**Verification:**
- Register → Login → Access protected route → Success
- Access protected route without token → 401
- Citizen access admin endpoint → 403
- Duplicate email registration → 409
- Admin seed script creates admin → Admin login works

---

### Phase 4 — Public Service Directory

**Dependencies:** Phase 2 (Service model), Phase 1 (routing)

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 4.1 | Create service Pydantic schemas | ServiceList, ServiceDetail |
| 4.2 | Implement GET /services (paginated, searchable) | Returns paginated list |
| 4.3 | Implement GET /services/{id} | Returns service detail |
| 4.4 | Implement GET /services/categories | Returns distinct categories |
| 4.5 | Create seed script with 15+ services | Services seeded in DB |
| 4.6 | Write pytest tests for services | All endpoints tested |

**Frontend Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 4.7 | Build Service Directory page | Lists services with pagination |
| 4.8 | Implement search bar | Searches by keyword |
| 4.9 | Implement category filter | Filters by category |
| 4.10 | Build Service Detail page | Shows full service info |
| 4.11 | Add "Sample Data" labels | Unverified services labeled |

**Verification:**
- 15+ services visible in directory
- Search returns relevant results
- Category filter works
- Detail page shows all fields
- Pagination works correctly

---

### Phase 5 — Grievance Submission

**Dependencies:** Phase 3 (auth), Phase 2 (Grievance model)

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 5.1 | Create grievance Pydantic schemas | CreateGrievance, GrievanceResponse |
| 5.2 | Implement reference number generator | Unique GRV-YYYYMMDD-XXXX format |
| 5.3 | Implement POST /grievances | Creates grievance + initial history |
| 5.4 | Implement file upload handling | Validates type/size, stores file |
| 5.5 | Implement GET /grievances/categories | Returns category list |
| 5.6 | Write pytest tests | Submission, validation, ownership tested |

**Frontend Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 5.7 | Build Submit Grievance page | Multi-field form with validation |
| 5.8 | Implement file attachment | File picker with type/size validation |
| 5.9 | Show submission confirmation | Reference number displayed |
| 5.10 | Build Citizen Dashboard | Shows summary stats |

**Verification:**
- Submit grievance → Reference number returned
- Grievance appears in database with status 'submitted'
- History record created
- File upload validates type and size
- Invalid submissions rejected with clear errors

---

### Phase 6 — Grievance Tracking

**Dependencies:** Phase 5

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 6.1 | Implement GET /grievances (citizen's own) | Returns only user's grievances |
| 6.2 | Implement GET /grievances/{id} with history | Returns detail + full history |
| 6.3 | Implement GET /grievances/track/{ref} | Finds by reference number |
| 6.4 | Enforce ownership check | 403 for other citizen's data |
| 6.5 | Write pytest tests | Tracking, ownership tests |

**Frontend Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 6.6 | Build My Grievances page | Lists with status badges |
| 6.7 | Build Grievance Detail page | Shows full detail |
| 6.8 | Build Status Timeline component | Visual history timeline |
| 6.9 | Implement reference number search | Search bar on tracking page |

**Verification:**
- Citizen sees only own grievances
- Timeline shows correct history
- Reference number search works
- Cannot view another citizen's grievance

---

### Phase 7 — Admin Dashboard

**Dependencies:** Phase 5, Phase 6, Phase 3 (admin auth)

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 7.1 | Implement GET /admin/dashboard/stats | Returns counts, distributions from DB |
| 7.2 | Implement GET /admin/grievances (all, filterable) | Returns all grievances, paginated |
| 7.3 | Implement GET /admin/grievances/{id} | Returns any grievance detail |
| 7.4 | Implement PATCH /admin/grievances/{id}/status | Updates status, creates history |
| 7.5 | Write pytest tests | Stats, listing, status update tested |

**Frontend Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 7.6 | Build Admin Dashboard page | Stats cards, category chart |
| 7.7 | Build Grievance Management page | Sortable, filterable table |
| 7.8 | Build Admin Grievance Detail page | Detail + status update form |
| 7.9 | Implement status update with remarks | Form submission updates status |
| 7.10 | Build Analytics page | Charts from real data |

**Verification:**
- Dashboard stats match database counts
- Filters and search work
- Status update creates history record
- Citizen sees updated status after admin change
- Non-admin cannot access any admin endpoint

---

### Phase 8 — AI Assistant and RAG

**Dependencies:** Phase 2 (KnowledgeDocument model), Phase 3 (auth)

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 8.1 | Create knowledge document seed data | 20+ documents covering service categories |
| 8.2 | Implement full-text search function | Returns ranked documents |
| 8.3 | Create Gemini API client wrapper | Calls API, handles errors |
| 8.4 | Build RAG pipeline | Search → Context → Generate |
| 8.5 | Create system prompt templates | Strict sourced-answer instructions |
| 8.6 | Implement POST /chat/sessions | Creates session |
| 8.7 | Implement GET /chat/sessions | Lists user's sessions |
| 8.8 | Implement POST /chat/sessions/{id}/messages | Full RAG pipeline |
| 8.9 | Implement GET /chat/sessions/{id}/messages | Returns chat history |
| 8.10 | Handle no-context scenario | Returns "insufficient info" response |
| 8.11 | Handle Gemini API errors gracefully | Returns user-friendly error |
| 8.12 | Write pytest tests (mock Gemini) | RAG pipeline tested |

**Frontend Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 8.13 | Build Chat interface | Message list + input |
| 8.14 | Implement session management | Create/switch sessions |
| 8.15 | Display AI responses with sources | Source cards with links |
| 8.16 | Display "AI-Generated" labels | Clear labeling |
| 8.17 | Show loading states | Typing indicator while waiting |

**Verification:**
- Ask relevant question → Sourced answer returned
- Ask irrelevant question → "Insufficient info" response
- Sources include document title, URL, review date
- Chat history persists across page refreshes
- Gemini API key never appears in frontend network tab

---

### Phase 9 — Frontend-Backend Integration Polish

**Dependencies:** Phases 3–8

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 9.1 | End-to-end citizen journey test | Register → Login → Submit → Track |
| 9.2 | End-to-end admin journey test | Login → View → Update → Verify |
| 9.3 | End-to-end AI journey test | Chat → Get answer → Check sources |
| 9.4 | Error handling polish | All API errors show user-friendly messages |
| 9.5 | Loading states | Every async operation has loading indicator |
| 9.6 | Empty states | Every list has empty state message |
| 9.7 | Responsive design verification | Test on mobile/tablet viewports |
| 9.8 | Navigation consistency | All links work, active states correct |
| 9.9 | Form validation UX | Field-level errors, disabled submit |

---

### Phase 10 — Testing, Security Review, and Bug Fixing

**Dependencies:** Phase 9

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 10.1 | Complete pytest test suite | ≥80% endpoint coverage |
| 10.2 | Run security checklist | All SECURITY_PLAN items verified |
| 10.3 | Verify no secrets in codebase | git grep for keys/passwords |
| 10.4 | Verify CORS configuration | Only allowed origins |
| 10.5 | Verify role enforcement | Citizen → admin endpoint = 403 |
| 10.6 | Verify ownership enforcement | Citizen A → Citizen B grievance = 403 |
| 10.7 | Postman collection creation | All endpoints documented |
| 10.8 | Bug fixing | All identified bugs fixed |
| 10.9 | Performance check | No N+1 queries, pagination works |

---

### Phase 11 — Deployment and Documentation

**Dependencies:** Phase 10

**Tasks:**
| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 11.1 | Deploy backend to Render | API accessible at public URL |
| 11.2 | Configure backend env vars on Render | All secrets set |
| 11.3 | Run Alembic migrations on production DB | Tables created |
| 11.4 | Run seed scripts on production | Admin + services + knowledge docs seeded |
| 11.5 | Deploy frontend to Vercel | App accessible at public URL |
| 11.6 | Configure frontend env vars on Vercel | API URL set |
| 11.7 | End-to-end production smoke test | Full journey works on deployed app |
| 11.8 | Write README.md | Setup, architecture, usage |
| 11.9 | Generate architecture diagram | Visual diagram |
| 11.10 | Generate ER diagram | Database relationships |
| 11.11 | Export Postman collection | JSON file in repo |
| 11.12 | Document API (FastAPI auto-docs) | /docs accessible |
| 11.13 | Prepare presentation slides | 8–12 slides |
| 11.14 | Record demo video | 3–5 minute walkthrough |
| 11.15 | Document team contributions | CONTRIBUTIONS.md |

---

## 3. Dependency Graph

```
Phase 0 (Planning)
    │
    ▼
Phase 1 (Scaffold) ─────────────────────────────────┐
    │                                                │
    ▼                                                │
Phase 2 (Database) ──────────────────┐               │
    │                                │               │
    ▼                                ▼               ▼
Phase 3 (Auth) ──────┐        Phase 4 (Services)  [Frontend structure]
    │                │              │
    ▼                ▼              │
Phase 5 (Submit)   Phase 8 (AI) ←──┘
    │
    ▼
Phase 6 (Tracking)
    │
    ▼
Phase 7 (Admin)
    │
    ▼
Phase 9 (Integration)
    │
    ▼
Phase 10 (Testing)
    │
    ▼
Phase 11 (Deployment)
```

---

## 4. Team Task Distribution Suggestion

| Team Member | Primary Responsibility | Phases |
|-------------|----------------------|--------|
| Member 1 | Backend architecture, Auth, Security | 1–3, 10 |
| Member 2 | Grievance module (backend + frontend) | 5–7 |
| Member 3 | Frontend architecture, UI/UX, Services | 1, 4, 9 |
| Member 4 | AI/RAG, Knowledge base, Deployment | 8, 11 |

> [!NOTE]
> All members should collaborate during Phase 9 (integration) and Phase 10 (testing). Assignments are suggestions — adjust based on team strengths.

---

## 5. Estimated Timeline

| Phase | Estimated Duration | Cumulative |
|-------|-------------------|------------|
| Phase 0 | 0.5 day | Day 0.5 |
| Phase 1 | 1 day | Day 1.5 |
| Phase 2 | 0.5 day | Day 2 |
| Phase 3 | 1.5 days | Day 3.5 |
| Phase 4 | 1 day | Day 4.5 |
| Phase 5 | 1 day | Day 5.5 |
| Phase 6 | 1 day | Day 6.5 |
| Phase 7 | 1.5 days | Day 8 |
| Phase 8 | 2 days | Day 10 |
| Phase 9 | 1 day | Day 11 |
| Phase 10 | 1.5 days | Day 12.5 |
| Phase 11 | 1.5 days | Day 14 |
| **Total** | **~14 days** | |

> [!TIP]
> Phases 4 and 8 can run in parallel with Phase 3 (they depend on Phase 2, not Phase 3) if different team members work on them.
