# Brainstorming Session Results

Date: 2025-09-10
Topic: Auth, Ditto reference alignment, Figma plugin scenario
Mode: Focused decisions with concise options and recommendations

## Inputs

- Reference: Ditto positioning on source of truth, design context, reviews, translation memory, API deploys (https://www.dittowords.com/)
- Stack: TanStack Start, Drizzle, Netlify (Functions), Postgres
- Constraint: Prefer Netlify Identity; enable Google OIDC; use better-auth guards

## Decisions

1. Authentication

- Choice: Netlify Identity (GoTrue) with Google OIDC provider
- Server: verify GoTrue JWT in TanStack Start server routes; map roles from app_metadata
- better-auth: use for typed guards/route protection on top of verified Identity tokens
- Rationale: native Netlify DX, minimal ops, aligns with serverless; Google is requirement

2. Ditto reference alignment

- Keep: single source of truth, review/approval, design-context workflows, API shipping
- Differentiate: service/common scoping, ICU/placeholder strict validators, enterprise RBAC, AI routing (BYO LLM), CLI/CI gates

3. Figma plugin scenario

- Flow: device-code/PAT-like login -> scoped token; link nodes to keys; pull/push copy; inline validation (ICU/glossary)
- Endpoints: /plugin/keys/search, /plugin/keys/link, /plugin/translations/pull, /plugin/suggestions
- Audit: include figma file/node ids in events for traceability

## Open Items to Validate

- AI provider(s) and residency constraints
- Scoping precedence rules and conflict resolution UX
- Import/export next formats priority: PO/XLIFF vs iOS/Android first

## Next Actions

- Implement auth middleware and role mapping in server routes (M0)
- Draft plugin endpoints and scopes; add CORS policy (M1)
- Define ICU/glossary validator contracts; add import dry-run (M1)
