# 3. Deployment & Runtime

- Target: Netlify Functions (server routes), optional Scheduled Functions for jobs (planned)
- Connection pooling: recommended Neon/PgBouncer per PRD
- Environment variables: declared in `src/env/server.ts` (server-only)
