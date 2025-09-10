# 16. Testing Strategy (Early)

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
