# 10. Security (Current vs Planned)

- Current: Authentication via Netlify Identity or better-auth session; server-only env usage
- Planned per PRD:
  - RBAC with row-level enforcement by `service` on queries and mutations
  - Secret management and least privilege for DB and providers
  - Webhooks authentication for outbound notifications
