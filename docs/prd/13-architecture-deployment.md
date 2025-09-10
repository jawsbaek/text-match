# 13. Architecture & Deployment

- Frontend: TanStack Start (React/TS), Tailwind; table via TanStack Table; Monaco editor with ICU syntax preview
- Backend: TanStack Start server routes on Netlify Functions; REST handlers
- DB: PostgreSQL; Drizzle ORM + drizzle‑kit migrations; docker‑compose for local
- Jobs: Netlify Scheduled Functions for batch suggestions
- Env: `DATABASE_URL`, `AI_PROVIDER_KEY`, `NETLIFY_IDENTITY_SITE`, etc.
- Connection pooling: Neon/PgBouncer recommended for Functions
