# Project Brief: Language Resource Management Web Service

## Overview
Centralized internal web service to browse, register, and AI‑assist edits of language resources (i18n keys/translations) across multiple company services, including shared "common" resources and service‑specific overrides.

Tech stack targets: TanStack Start (React/TS), Drizzle ORM (PostgreSQL), Netlify deployment.

## Competitive Reference & Differentiation
- Reference: Ditto – product copy source of truth, design‑in‑context editing, review workflows, translation memory, and API deploys [link](`https://www.dittowords.com/`).
- We align on: single source of truth, design‑context collaboration, centralized reviews, localization workflows, and API‑based shipping.
- We differentiate via: service/common scoping with inheritance, stricter ICU/placeholder validators, enterprise RBAC, on‑prem/bring‑your‑own LLM routing, and developer‑centric CLI/CI gates.

## Goals (What Success Looks Like)
- Single source of truth for i18n keys/translations across services and locales
- Fast search/filtering and safe workflows (draft → review → approved)
- AI‑assisted editing that preserves placeholders/ICU and glossary
- Seamless CI/CLI import/export for engineering teams

## Primary Users & Roles
- Admin: system setup, RBAC, governance
- Project Owner: per‑service management, releases
- Editor/Translator: create/edit translations
- Reviewer: approve changes
- Viewer: read‑only

## Scope
In scope (Phase M0–M2):
- Browse/filter by service/common, namespace, key prefix, locale, status, tags
- New key/translation creation (wizard + validations)
- Import/export (JSON, ICU MessageFormat; add PO/XLIFF later)
- AI suggestions with guardrails (placeholders/glossary/style)
- Audit log, review workflow, release snapshots per service/locale

Out of scope (initial):
- SSO/SCIM, vendor connectors, advanced TMS features, OpenSearch cluster

## Functional Requirements (FR)
FR‑1 Browse & Filter: table with faceted filters; key detail view with history
FR‑2 Service/Common Scoping: inheritance visualization; override warnings
FR‑3 Create/Register: key naming guardrails; conflict detection; pluralization hints
FR‑4 Validation: ICU/placeholder parity; locale codes (BCP‑47); style checks
FR‑5 Workflow: draft → review → approved; reviewer assignment per locale
FR‑6 Import/Export: JSON/ICU round‑trip; dry‑run report; release bundles
FR‑7 AI‑Assist: batch suggestions; confidence scoring; human‑in‑the‑loop
FR‑8 Auditability: who/what/when before/after; diff view
FR‑9 API/CLI: pull/push by service/locale; webhooks on approve/release

## Non‑Functional Requirements (NFR)
- Availability: ≥ 99.9% (business hours), backups daily
- Performance: P95 list page ≤ 300ms on 5k keys; search ≤ 800ms
- Security: RBAC, row‑level auth by service, encrypted env on Netlify
- Reliability: schema migrations via Drizzle; transactional writes

## High‑Level Architecture (TanStack Start + Netlify + Drizzle)
- Frontend: TanStack Start (file‑based routing, SSR/CSR hybrid), React 19, Tailwind
- Server runtime: TanStack Start server routes deployed to Netlify Functions/Edge (per adapter); REST/HTTP handlers under server routes
- Database: PostgreSQL (managed or self‑hosted); local dev via docker‑compose
- ORM: Drizzle ORM + drizzle‑kit migrations; `DATABASE_URL` via Netlify env
- Background jobs: Netlify Scheduled Functions for batch AI suggestion runs
- Caching: in‑memory per‑instance; consider Redis later if needed
- Observability: structured logs; request IDs; basic metrics

Authentication & Authorization
- Primary auth: Netlify Identity (GoTrue) with Google OIDC provider
- Implementation: client `gotrue-js` (or Netlify Identity widget) + server JWT verification middleware in TanStack Start server routes
- Roles: map Identity app_metadata/roles → RBAC (Admin/Owner/Editor/Reviewer/Viewer); store service‑level permissions in DB and hydrate on session
- better‑auth usage: leverage better‑auth server utilities for type‑safe guards/route protection by verifying GoTrue JWT and enriching context; no duplicate user store

Deployment notes (Netlify):
- Use Netlify adapter for Vite/TanStack Start SSR; map server routes to Functions
- Configure connection pooling (e.g., PgBouncer/Neon) for Functions cold starts
- Secure env vars: `DATABASE_URL`, `AI_PROVIDER_KEY`, etc.

## Data Model (Sketch)
- Service(id, code, name, owners[])
- Namespace(id, service_id, name)
- Key(id, service_id|null for common, namespace_id, key_name, tags[], status)
- Translation(id, key_id, locale, value, status, version, checksum)
- Suggestion(id, translation_id, source: TM|LLM|MT|human, score, violations[])
- GlossaryTerm(id, term, locale, preferred, discouraged, aliases[])
- ReleaseBundle(id, service_id, locales[], created_at, snapshot_ref)
- User(id, email) / Role(id, name) / Permission(map)
- Event(id, actor, action, entity_ref, before, after, created_at)

## API Surface (Initial)
- GET /api/keys?service=web&locale=ko&status=missing&prefix=auth
- POST /api/keys (create key + required locales)
- PUT /api/translations/:id (edit/status)
- POST /api/translations/:id/suggest (AI/TM)
- POST /api/import | GET /api/export?format=json&service=web&locales=ko,ja
- GET /api/releases?service=web | POST /api/releases (snapshot)

## AI Strategy
- Provider: pluggable (OpenAI/Azure/Anthropic/Google/DeepL); key via env
- Prompting: include TM/examples, glossary, style rules, and strict placeholder schema
- Validation: deterministic ICU/placeholder/glossary checker gates acceptance
- Routing: short UI strings → LLM; long content → MT; cost caps + caching
- Human‑in‑the‑loop: accept/modify/reject with comments; auto‑review for low scores

## Import/Export & Validation
- Internal canonical: ICU MessageFormat; adapters to/from JSON and later PO/XLIFF
- Pre‑flight: dry‑run import with lint report (duplicates, missing placeholders)
- CI: CLI to verify repo resource files before merge (optional Phase M3)

## Figma Plugin Integration Scenario (Design‑in‑Context)
Goals
- Let designers work with real copy: browse/search keys, link nodes ↔ keys, pull translations, and propose edits from Figma

User Flow
1) Plugin login: opens our auth page; user signs in via Netlify Identity (Google) → returns short‑lived token to plugin via redirect/deeplink
2) Link nodes: select Figma nodes → search keys by service/namespace/prefix → link; node stores `key_ref` in plugin data
3) Pull copy: fetch current translations for target locale(s); render into node text; show status (draft/review/approved)
4) Propose edits/new keys: create draft suggestion or new key with namespace hints; send for review; track back‑links
5) Validation preview: ICU/placeholder checks before submit; glossary/style warnings inline

Plugin API considerations
- Endpoints: `/plugin/keys/search`, `/plugin/keys/link`, `/plugin/translations/pull`, `/plugin/suggestions` (CORS enabled)
- Auth: PAT or OAuth device‑code‑like flow returning scoped token; scopes limited to selected services
- Audit: events record plugin origin and Figma file/node ids for traceability

## Milestones & Deliverables
M0 (2–3 wks): schema, auth/RBAC MVP, key/translation CRUD, JSON import/export, audit log
M1 (3–4 wks): review workflow, service/common scoping, ICU validator, release bundles
M2 (3–4 wks): AI suggestions + validators, glossary/style guide, batch fills, scoring
M3 (2–3 wks): adapters (PO/XLIFF), CLI/SDK, CI gate, dashboards, optional search upgrade

## Risks & Mitigations
- DB connections on serverless: use pooled provider (Neon + pooling, PgBouncer)
- AI hallucinations: strict validators + reviewer gate; glossary enforcement
- Cost creep: batching, caching, thresholds, per‑locale routing
- Search latency: add indexes; consider OpenSearch if scale demands

## Open Questions / Where Brainstorming Helps
1. AI provider & data residency constraints; on‑prem vs SaaS keys
2. Glossary/style guide ownership and authoring workflow
3. Service/common scoping rules (override precedence, conflict policy)
4. Import/export formats priority beyond JSON/ICU (PO, XLIFF, iOS/Android)
5. Netlify SSR adapter choice and edge vs functions for DB access
6. Do we need multi‑tenant (team/org) separation now or later?

## Initial Implementation Plan (Repo‑Aligned)
- Use existing `docker-compose.yml` Postgres for local dev
- Configure Drizzle (`drizzle.config.ts`) and create schemas for entities above
- Add TanStack Start routes: `/keys`, `/translations`, `/releases`, `/import`, `/export`
- Create server handlers under Start server routes; wire Drizzle queries
- Add ICU/placeholder validator utility and import dry‑run endpoint
- Prepare Netlify build with SSR adapter and env variables

## Definition of Done (Phase M0)
- CRUD + JSON import/export working locally and on Netlify
- Basic RBAC by role; audit records for mutations
- ICU/placeholder validation on create/update/import
- Smoke tests for APIs; basic E2E for browse/create


