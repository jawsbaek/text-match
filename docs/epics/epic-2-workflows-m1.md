# Epic 2: Workflows & Validation (M1)

Goal: Enable review workflow, service/common scoping visualization with overrides, ICU/placeholder validator, and release bundles.

Scope reference: PRD §14 M1; FR-2, FR-4, FR-5, FR-6 (bundles); §6 NFR.

## Stories

### 2.1 Review Workflow (Draft → Review → Approved)

As a reviewer,
I want a review process with required reviewers per locale,
so that only vetted translations are approved.

Acceptance Criteria

- Status transitions: draft → review → approved with permissions and rules
- Assign reviewers per locale; track decisions and comments
- Audit events generated for transitions

### 2.2 Service/Common Scoping & Inheritance

As an editor,
I want visualization of service/common scoping and overrides,
so that I understand inheritance and conflicts.

Acceptance Criteria

- Computed view of key resolution (common → service override)
- Override warnings and conflict detection
- Filtering by scope in browse view

### 2.3 ICU/Placeholder Validator

As a system,
I want strict ICU/placeholder validation and parity checks,
so that invalid content is blocked before approval.

Acceptance Criteria

- Deterministic validator for ICU message syntax and placeholder parity
- Blocks approval if violations present; shows violations per locale
- Unit tests cover common and edge cases

### 2.4 Release Bundles

As a project owner,
I want to create release bundles by service and locales,
so that I can ship consistent, versioned resources.

Acceptance Criteria

- Create snapshot of keys/translations by service + locales
- Export bundles and track metadata (created_at, snapshot_ref)
- Webhook emitted on bundle creation

## Cross‑cutting NFRs (M1)

- Validator path must add ≤ 50ms overhead at P95
- Reliability: transactional updates; snapshot integrity verified
