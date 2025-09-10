# Product Requirements Document (PRD)

Title: Language Resource Management Web Service
Owner: PM
Date: 2025-09-10
Status: Draft

## 1. Summary

Centralized internal platform to browse, create, and AI‑assist edits of product copy/i18n resources across multiple services and locales, with auditability, review workflows, service/common scoping, and developer integrations. Informed by Ditto’s approach to copy as a source of truth while differentiating in service scoping and strict ICU/placeholder safety.

Reference: Project Brief (./project-brief.md), Ditto (https://www.dittowords.com/).

## 2. Goals & Non‑Goals

### Goals

- Single source of truth for i18n keys/translations across services (including shared common) and locales
- Fast search/filter and diff; safe workflows (draft → review → approved) with audit
- AI‑assisted editing with strict validators (ICU/placeholders/glossary)
- Smooth import/export and CI/CLI for engineering
- Figma plugin workflow for design‑in‑context copy

### Non‑Goals (Initial)

- SSO/SCIM, vendor connectors, advanced TMS features, dedicated search cluster

## 3. Users & Roles

- Admin: system policy, RBAC
- Project Owner: manage services/namespaces, releases
- Editor/Translator: create/edit translations
- Reviewer: approvals
- Viewer: read‑only

RBAC: Admin, Owner, Editor, Reviewer, Viewer; per‑service permissions.

## 4. Scope

In scope Phases M0–M2 per brief; out‑of‑scope listed above. Figma plugin: MVP endpoints for key linking, pull/push, and suggestions.

## 5. Functional Requirements (FR)

FR‑1 Browse & Filter: faceted filters (service/common, namespace, key prefix, locale, status, tags); table view; key detail with history
FR‑2 Service/Common Scoping: inheritance visualization; override warnings; conflict detection
FR‑3 Create/Register: new key wizard; naming guardrails; conflict checks; pluralization hints
FR‑4 Validation: ICU/placeholder parity; variable consistency; BCP‑47 codes; style checks
FR‑5 Workflow: draft → review → approved; required reviewers per locale; comments
FR‑6 Import/Export: JSON + ICU round‑trip; dry‑run reports; release bundles
FR‑7 AI‑Assist: suggestions (batch); confidence scoring; human‑in‑the‑loop accept/modify/reject; explain‑why
FR‑8 Auditability: track who/what/when; before/after diffs; webhooks
FR‑9 API/CLI: pull/push per service/locale; plugin endpoints; future CI gate
FR‑10 Figma Plugin: login, link nodes to keys, pull/push copy, inline validation

## 6. Non‑Functional Requirements (NFR)

- Availability ≥ 99.9% business hours; daily backups
- Performance: P95 list ≤ 300ms (5k keys), search ≤ 800ms
- Security: RBAC, row‑level auth by service; encrypted env; least privilege
- Reliability: transactional writes; Drizzle migrations; release snapshots

## 7. Competitive Reference & Differentiation

- Reference: Ditto for copy workflows and API shipping (https://www.dittowords.com/)
- Differentiators: service/common scoping, strict ICU/placeholder validators, enterprise RBAC, BYO LLM routing, developer‑centric CLI/CI gates

## 8. Experience Requirements

### UX Flows

- Browse: filters + search; missing by locale; status chips; click to key detail
- Key Detail: values per locale, history, approvals, suggestions tab
- New Key: select service/common + namespace, naming guardrails, required locales checklist
- Review: compare versions; approve/reject with notes; audit timeline
- Import: upload JSON/ICU; dry‑run report; apply
- Releases: create bundle by service + locales; export
- Figma: node link/search; pull copy; propose edits with validations

### Accessibility

- Keyboard nav, screen‑reader labels, color contrast

## 9. Information Architecture / Data Model (MVP)

Entities

- Service(id, code, name, owners[])
- Namespace(id, service_id, name)
- Key(id, service_id|null for common, namespace_id, key_name, tags[], status)
- Translation(id, key_id, locale, value, status, version, checksum)
- Suggestion(id, translation_id, source, score, violations[])
- GlossaryTerm(id, term, locale, preferred, discouraged, aliases[])
- ReleaseBundle(id, service_id, locales[], created_at, snapshot_ref)
- User(id, email), Role(id, name), Permission(map)
- Event(id, actor, action, entity_ref, before, after, created_at)

## 10. APIs (Initial)

Public (authenticated)

- GET /api/keys?service=web&locale=ko&status=missing&prefix=auth
- POST /api/keys
- PUT /api/translations/:id
- POST /api/translations/:id/suggest
- POST /api/import | GET /api/export?format=json&service=web&locales=ko,ja
- GET /api/releases?service=web | POST /api/releases

Plugin

- POST /api/plugin/login (device‑code/PAT like)
- GET /api/plugin/keys/search
- POST /api/plugin/keys/link
- GET /api/plugin/translations/pull
- POST /api/plugin/suggestions

Webhooks

- POST <hook> on translation approved, key changed, release created

## 11. AI Strategy

- Providers: pluggable (OpenAI/Azure/Anthropic/Google/DeepL)
- Prompting: TM examples, glossary, style, strict placeholder schema; include key/namespace context
- Validation: deterministic ICU/placeholder/glossary checker blocks acceptance
- Routing: short UI strings → LLM; long docs → MT; cost caps; caching
- Human‑in‑the‑loop: accept/modify/reject; auto‑review for low confidence

## 12. Authentication & Authorization

- Primary: Netlify Identity (GoTrue) with Google OIDC provider
- Server: verify GoTrue JWT in TanStack Start server routes; map app_metadata roles
- better‑auth: typed guards wrapping verified Identity tokens; enrich context with service permissions from DB

## 13. Architecture & Deployment

- Frontend: TanStack Start (React/TS), Tailwind; table via TanStack Table; Monaco editor with ICU syntax preview
- Backend: TanStack Start server routes on Netlify Functions; REST handlers
- DB: PostgreSQL; Drizzle ORM + drizzle‑kit migrations; docker‑compose for local
- Jobs: Netlify Scheduled Functions for batch suggestions
- Env: `DATABASE_URL`, `AI_PROVIDER_KEY`, `NETLIFY_IDENTITY_SITE`, etc.
- Connection pooling: Neon/PgBouncer recommended for Functions

## 14. Milestones & Deliverables

- M0 (2–3 wks): schema, auth/RBAC MVP, key/translation CRUD, JSON import/export, audit log
- M1 (3–4 wks): review workflow, service/common scoping, ICU validator, release bundles
- M2 (3–4 wks): AI suggestions + validators, glossary/style guide, batch fills, scoring
- M3 (2–3 wks): adapters (PO/XLIFF), CLI/SDK, CI gate, dashboards, search upgrade option

## 15. Acceptance Criteria (Release Gates)

- M0: CRUD + JSON import/export on Netlify; RBAC enforced; audit for all mutations; unit/E2E smoke pass
- M1: Review workflow operational; scoping/inheritance with warnings; validator blocks invalid ICU/placeholders; releases export/import round‑trip
- M2: AI suggestions with validator gating and review; glossary/style checks; batch fill; confidence scoring visible; human‑in‑loop

## 16. Metrics

- Missing translations trend; time‑to‑approval; AI suggestion acceptance rate; placeholder/ICU error rate; P95 search latency; MT/LLM cost per accepted string

## 17. Risks & Mitigations

- Serverless DB connections → pooling/Neon
- AI hallucinations → validators + review gates
- Cost creep → routing, quotas, caching
- Search scale → add indexes; consider OpenSearch in M3

## 18. Open Questions

- AI provider and data residency constraints
- Scoping precedence & conflict resolution UX
- Next format priorities: PO/XLIFF vs iOS/Android
- Netlify Edge vs Functions for DB access (likely Functions initially)
- Tenancy: single now, multi‑tenant later

## 19. Appendices

- Project Brief: ./project-brief.md
- Brainstorming Results: ./brainstorming-session-results.md
