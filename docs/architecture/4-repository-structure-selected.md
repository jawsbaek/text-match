# 4. Repository Structure (selected)

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
