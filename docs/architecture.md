# Architecture

This document derives from the Product Requirements (`docs/prd.md`) and reflects the current codebase. It captures the present technical architecture, identifies what already exists, and outlines what is planned per the PRD.

## 1. Overview

- App: Language Resource Management Web Service
- Purpose: Central source of truth for i18n keys and translations with workflows, validators, auditability, and developer integrations.
- Source PRD: `docs/prd.md`

## 2. Tech Stack

- Frontend: TanStack Start (React + TypeScript), Tailwind CSS
- Server runtime: TanStack Start server routes (Node on Netlify Functions)
- Database: PostgreSQL, Drizzle ORM, drizzle-kit migrations, snake_case
- Auth: Netlify Identity (GoTrue) bearer support + better-auth sessions
- Validation: Zod for request validation

## 3. Deployment & Runtime

- Target: Netlify Functions (server routes), optional Scheduled Functions for jobs (planned)
- Connection pooling: recommended Neon/PgBouncer per PRD
- Environment variables: declared in `src/env/server.ts` (server-only)

## 4. Repository Structure (selected)

```text
src/
  lib/
    auth/           # better-auth setup, Netlify Identity verification, middleware
    db/             # Drizzle client + schema
      schema/
        auth.schema.ts
        l10n.schema.ts
  routes/
    api/            # Server API routes (TanStack Start)
      keys.ts       # /api/keys (GET, POST)
```

## 5. Backend: Server Routes

- Framework: TanStack Start server routes via `createServerFileRoute`.
- Conventions: Validate inputs with Zod; return `Response` with proper `content-type`; add auth middleware.

### 5.1 Implemented Endpoints

- `GET /api/keys` (file: `src/routes/api/keys.ts`)
  - Filters: `prefix`, `service` (code) → joins service by code and filters keys
  - Returns up to 100 items
- `POST /api/keys`
  - Body schema: `{ id: string; keyName: string; serviceCode?: string; namespaceId?: string; tags?: string[] }`
  - Validates with Zod, resolves `serviceCode` → `serviceId`, inserts key

### 5.2 Planned Endpoints (from PRD)

- Keys: POST/PUT for translations, suggestions, import/export, releases, plugin APIs
- Examples in PRD: `/api/translations/:id`, `/api/translations/:id/suggest`, `/api/import`, `/api/export`, `/api/releases`, plugin endpoints

## 6. Authentication & Authorization

- Middleware: `src/lib/auth/middleware.ts`
  - Prefers Netlify Identity Bearer token → `verifyIdentityJWT`
  - Fallback: `better-auth` session (`auth.api.getSession`) and maps to a normalized user
  - On failure: sets 401 and throws
- better-auth config: `src/lib/auth/auth.ts`
  - Drizzle adapter (Postgres), cookie cache for session perf, optional social providers (GitHub/Google), email+password enabled
- RBAC & Row-level auth (PRD): Planned; enforcement at service-scope to be added into handlers/queries

## 7. Database & ORM

- Client: `src/lib/db/index.ts`
  - Postgres driver from `DATABASE_URL`, Drizzle with `schema` barrel and `snake_case`
- Drizzle config: `drizzle.config.ts` (schema path, strict, verbose, snake_case)
- Schemas (selected fields):

### 7.1 Auth (`auth.schema.ts`)

- `user(id, name, email, email_verified, image, created_at, updated_at)`
- `session(id, expires_at, token, ip_address, user_agent, user_id)` → FK `user`
- `account(id, account_id, provider_id, user_id, access/refresh tokens...)` → FK `user`
- `verification(id, identifier, value, expires_at, created_at, updated_at)`

### 7.2 L10n (`l10n.schema.ts`)

- `service(id, code, name, owners[], created_at, updated_at)`
- `namespace(id, service_id?, name, created_at, updated_at)`
- `l10n_key(id, service_id?, namespace_id?, key_name, tags[], status, created_at, updated_at)`
- `translation(id, key_id, locale, value, status, version, checksum, created_at, updated_at)`
- `release_bundle(id, service_id, locales[], snapshot_ref, created_at)`
- `event(id, actor, action, entity_type, entity_id, before jsonb, after jsonb, created_at)`

- Migrations: managed via drizzle-kit; keep schema drift controlled; add indexes for search and lookups as scale increases

## 8. Environment & Configuration

From `src/env/server.ts` (server-only):

- `DATABASE_URL` (required)
- `VITE_BASE_URL` (default http://localhost:3000)
- `BETTER_AUTH_SECRET` (required)
- OAuth (optional): `GITHUB_CLIENT_ID|SECRET`, `GOOGLE_CLIENT_ID|SECRET`
- Netlify Identity (optional): `NETLIFY_IDENTITY_SITE`, `NETLIFY_IDENTITY_AUD`

## 9. Validation, Errors, Logging

- Inputs: Zod schemas at route boundary (e.g., `createKeySchema`)
- Errors: 400 for validation errors; 401 for unauthorized
- Logging: Prefer structured logs with request correlation (to be added)

## 10. Security (Current vs Planned)

- Current: Authentication via Netlify Identity or better-auth session; server-only env usage
- Planned per PRD:
  - RBAC with row-level enforcement by `service` on queries and mutations
  - Secret management and least privilege for DB and providers
  - Webhooks authentication for outbound notifications

## 11. Performance & Reliability Targets (from PRD)

- Performance targets (MVP): P95 list ≤ 300ms (5k keys), search ≤ 800ms
- Reliability: transactional writes; migrations; release snapshots
- Connection pooling for serverless recommended

## 12. Roadmap Alignment (PRD → Implementation)

- M0: Auth, schema, key/translation CRUD, JSON import/export, audit log
  - Current: Schema + auth foundation + `/api/keys` basic CRUD (partial)
- M1: Review workflow, scoping/inheritance, validators, releases
- M2: AI suggestions, glossary/style checks, batch fills, scoring

## 13. Development Standards

- TanStack Start routing and middleware patterns
- Drizzle rules: typed queries, `where/and/eq/ilike`, transactions for multi-writes
- Zod validation before DB access
- Return `Response` with correct headers

## 14. Next Steps

- Expand API surface according to PRD (translations, import/export, releases)
- Introduce RBAC and row-level auth guards in queries
- Add indexes and query plans for common filters
- Implement auditing on all mutations (insert into `event`)
- Add structured logging and request IDs

## 15. Sharding Plan (v4 Architecture Docs)

When the system grows, shard this document under `docs/architecture/`:

- `index.md` (overview, scope, roadmap)
- `tech-stack.md`
- `unified-project-structure.md`
- `backend-architecture.md` (server routes, middleware, auth)
- `frontend-architecture.md` (routing, UI patterns)
- `data-models.md` (Drizzle schemas overview)
- `rest-api-spec.md` (endpoints and contracts)
- `testing-strategy.md`

Optional: use `@kayvan/markdown-tree-parser` to explode monolith into shards when ready.

## 16. Testing Strategy (Early)

- Levels
  - Unit: Zod schemas, auth helpers, pure utilities and service functions
  - Integration: Drizzle queries against a disposable Postgres, auth middleware wiring, route handler happy/edge paths
  - E2E (later): Core UI flows once pages stabilize

- Runner & Tooling
  - Vitest as test runner (node env by default, jsdom only for UI tests)
  - Optional libs: Testing Library (React), MSW for browser-side mocks

- Structure
  - Colocated unit tests under `src/**/__tests__/*.test.ts`
  - DB-backed integration tests under `tests/integration/**`
  - Shared helpers under `tests/utils/` (`testDb.ts`, `factories.ts`, `auth.ts`)

- Integration DB
  - Use Docker Postgres from `docker-compose.yml` or Testcontainers in CI
  - Apply migrations before tests via drizzle-kit `push`

- Initial Priorities (M0)
  - Validate `POST /api/keys` body schema and error mapping (400)
  - Auth middleware 401 on missing/invalid credentials
  - `GET /api/keys` filters (`prefix` and `service` join) and 100-row limit
  - Service code resolution behavior: 404 on unknown, insert with resolved `serviceId`

- CI
  - Run format/lint/typecheck, then `vitest --run`
  - For integration, provision Postgres, run migrations, then execute tests
