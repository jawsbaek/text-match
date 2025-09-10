# Epic 1: Foundation (M0)

Goal: Establish data schema, authentication/RBAC, core CRUD + import/export, and auditing.

Scope reference: PRD §14 M0; FR-1, FR-3, FR-6, FR-8, FR-9 (subset); §12 Auth; §13 Architecture; §6 NFR.

## Stories

### 1.1 Data Schema & Drizzle Migrations

As a developer,
I want normalized schemas and reproducible migrations for core entities,
so that we can persist and evolve product data safely.

Acceptance Criteria

- Drizzle schemas for: Service, Namespace, Key, Translation, User, Role, Permission map, Event (audit)
- FKs/uniques align with PRD §9; enums for statuses and locales
- drizzle-kit migrations generated; up/down runnable locally and in CI
- Seed script creates minimal bootstrap data (one service, locales)

### 1.2 Authentication (Netlify Identity) Integration

As a user,
I want secure authentication via Netlify Identity (GoTrue),
so that only authorized users access the system.

Acceptance Criteria

- Server routes verify GoTrue JWT (issuer/site from env)
- App metadata roles mapped into app context (§12)
- Guards/middleware enforce auth on /api/\*\* with 401/403 as appropriate

### 1.3 RBAC & Row-Level Authorization

As an admin,
I want per-service RBAC and row-level checks,
so that teams only access data they are allowed to.

Acceptance Criteria

- Roles: Admin, Owner, Editor, Reviewer, Viewer
- Role-to-permission mapping defined and enforced
- Row-level checks by service for Keys/Translations (read/write)
- Unit tests validate allow/deny matrices per role

### 1.4 Keys & Translations CRUD APIs (MVP)

As an editor,
I want to manage keys/translations via APIs,
so that we can curate localized copy.

Acceptance Criteria

- Endpoints: GET /api/keys, POST /api/keys, PUT /api/translations/:id
- Validation: key naming guardrails; BCP‑47 locale codes
- Filters: service, locale, status, prefix; pagination
- RBAC enforced on all endpoints; unit tests for happy/deny

### 1.5 JSON Import/Export with Dry‑Run

As a project owner,
I want JSON/ICU import/export with dry‑run capability,
so that teams can sync resources safely.

Acceptance Criteria

- POST /api/import (dry‑run flag) returns diff/report; no mutation on dry‑run
- Import applies changes transactionally on commit
- GET /api/export?service&locales round‑trips with import for basic cases

### 1.6 Mutation Audit Log

As a reviewer,
I want an audit trail,
so that we know who changed what and when.

Acceptance Criteria

- Event row per create/update/delete of Keys/Translations
- Captures actor, action, entity ref, before/after, timestamp
- GET /api/events?entity=... lists events; sensitive data redacted

## Cross‑cutting NFRs (M0)

- P95 ≤ 300ms for list endpoints at 5k keys (§6)
- Transactional writes; migrations versioned (§6, §13)
- Structured logging with request id; standardized error responses
- Env vars documented: DATABASE_URL, NETLIFY_IDENTITY_SITE, etc.
