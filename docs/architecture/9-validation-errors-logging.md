# 9. Validation, Errors, Logging

- Inputs: Zod schemas at route boundary (e.g., `createKeySchema`)
- Errors: 400 for validation errors; 401 for unauthorized
- Logging: Prefer structured logs with request correlation (to be added)
