# 12. Authentication & Authorization

- Primary: Netlify Identity (GoTrue) with Google OIDC provider
- Server: verify GoTrue JWT in TanStack Start server routes; map app_metadata roles
- better‑auth: typed guards wrapping verified Identity tokens; enrich context with service permissions from DB
