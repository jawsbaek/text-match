# 6. Non‑Functional Requirements (NFR)

- Availability ≥ 99.9% business hours; daily backups
- Performance: P95 list ≤ 300ms (5k keys), search ≤ 800ms
- Security: RBAC, row‑level auth by service; encrypted env; least privilege
- Reliability: transactional writes; Drizzle migrations; release snapshots
