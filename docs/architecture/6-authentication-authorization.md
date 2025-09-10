# 6. Authentication & Authorization

- Middleware: `src/lib/auth/middleware.ts`
  - Prefers Netlify Identity Bearer token → `verifyIdentityJWT`
  - Fallback: `better-auth` session (`auth.api.getSession`) and maps to a normalized user
  - On failure: sets 401 and throws
- better-auth config: `src/lib/auth/auth.ts`
  - Drizzle adapter (Postgres), cookie cache for session perf, optional social providers (GitHub/Google), email+password enabled
- RBAC & Row-level auth (PRD): Planned; enforcement at service-scope to be added into handlers/queries
