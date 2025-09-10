# Epic 3: AI Suggestions, Glossary & Batch (M2)

Goal: Add AI-assisted suggestions with validator gating, glossary/style guides, batch fills, and confidence scoring.

Scope reference: PRD §14 M2; FR-7; §11 AI Strategy; §6 NFR.

## Stories

### 3.1 AI Suggestion Service

As an editor,
I want AI suggestions for translations with context,
so that I can speed up authoring safely.

Acceptance Criteria

- Providers pluggable (OpenAI/Azure/Anthropic/Google/DeepL)
- Prompt includes key/namespace, glossary, style, placeholders schema
- Suggestions returned with confidence score; cached to control cost

### 3.2 Validator Gating for AI

As a reviewer,
I want validator-enforced gating of AI outputs,
so that invalid placeholders/ICU cannot be accepted.

Acceptance Criteria

- Suggestions failing validator cannot be applied
- UI/API surfaces violations and remediation hints

### 3.3 Glossary & Style Guide

As a localization lead,
I want glossary and style rules enforced,
so that terminology remains consistent.

Acceptance Criteria

- GlossaryTerm model CRUD; preferred/discouraged/aliases per locale
- Style checks applied; violations listed on suggestions and review

### 3.4 Batch Fill & Confidence Scoring

As a translator,
I want batch fill of suggestions with confidence thresholds,
so that I can process at scale with control.

Acceptance Criteria

- Batch endpoint applies suggestions above threshold
- Human-in-the-loop accept/modify/reject workflow maintained
- Confidence visible in UI and exportable in reports

## Cross‑cutting NFRs (M2)

- Cost caps and caching per provider; SLA fallbacks
- Security: least-privilege API keys; no PII leakage
