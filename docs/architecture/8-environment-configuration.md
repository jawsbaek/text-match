# 8. Environment & Configuration

From `src/env/server.ts` (server-only):

- `DATABASE_URL` (required)
- `VITE_BASE_URL` (default http://localhost:3000)
- `BETTER_AUTH_SECRET` (required)
- OAuth (optional): `GITHUB_CLIENT_ID|SECRET`, `GOOGLE_CLIENT_ID|SECRET`
- Netlify Identity (optional): `NETLIFY_IDENTITY_SITE`, `NETLIFY_IDENTITY_AUD`
