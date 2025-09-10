# 7. Database & ORM

- Client: `src/lib/db/index.ts`
  - Postgres driver from `DATABASE_URL`, Drizzle with `schema` barrel and `snake_case`
- Drizzle config: `drizzle.config.ts` (schema path, strict, verbose, snake_case)
- Schemas (selected fields):

## 7.1 Auth (`auth.schema.ts`)

- `user(id, name, email, email_verified, image, created_at, updated_at)`
- `session(id, expires_at, token, ip_address, user_agent, user_id)` → FK `user`
- `account(id, account_id, provider_id, user_id, access/refresh tokens...)` → FK `user`
- `verification(id, identifier, value, expires_at, created_at, updated_at)`

## 7.2 L10n (`l10n.schema.ts`)

- `service(id, code, name, owners[], created_at, updated_at)`
- `namespace(id, service_id?, name, created_at, updated_at)`
- `l10n_key(id, service_id?, namespace_id?, key_name, tags[], status, created_at, updated_at)`
- `translation(id, key_id, locale, value, status, version, checksum, created_at, updated_at)`
- `release_bundle(id, service_id, locales[], snapshot_ref, created_at)`
- `event(id, actor, action, entity_type, entity_id, before jsonb, after jsonb, created_at)`

- Migrations: managed via drizzle-kit; keep schema drift controlled; add indexes for search and lookups as scale increases
