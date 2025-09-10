# 5. Backend: Server Routes

- Framework: TanStack Start server routes via `createServerFileRoute`.
- Conventions: Validate inputs with Zod; return `Response` with proper `content-type`; add auth middleware.

## 5.1 Implemented Endpoints

- `GET /api/keys` (file: `src/routes/api/keys.ts`)
  - Filters: `prefix`, `service` (code) → joins service by code and filters keys
  - Returns up to 100 items
- `POST /api/keys`
  - Body schema: `{ id: string; keyName: string; serviceCode?: string; namespaceId?: string; tags?: string[] }`
  - Validates with Zod, resolves `serviceCode` → `serviceId`, inserts key

## 5.2 Planned Endpoints (from PRD)

- Keys: POST/PUT for translations, suggestions, import/export, releases, plugin APIs
- Examples in PRD: `/api/translations/:id`, `/api/translations/:id/suggest`, `/api/import`, `/api/export`, `/api/releases`, plugin endpoints
