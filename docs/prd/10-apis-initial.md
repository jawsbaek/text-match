# 10. APIs (Initial)

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
