# Authentication & Authorization

This directory contains the authentication and authorization system for the application.

## Overview

The auth system implements a multi-layered approach:

1. **Authentication**: Netlify Identity (GoTrue) JWT tokens + better-auth sessions
2. **Role-Based Access Control (RBAC)**: 5 roles with hierarchical permissions
3. **Service-Level Authorization**: Row-level access control based on service ownership
4. **Resource Inheritance**: Translations inherit access from keys, keys inherit from services

## File Structure

```
src/lib/auth/
├── README.md                    # This file
├── auth.ts                      # better-auth configuration
├── auth-client.ts               # Client-side auth utilities
├── functions.ts                 # Auth utility functions
├── identity.ts                  # Netlify Identity JWT verification
├── middleware.ts                # Auth middleware for routes
├── queries.ts                   # Database queries for auth
├── rbac.ts                      # Role-based access control
├── service-access.ts            # Service-level authorization
├── translation-access.ts        # Translation access inheritance
└── __tests__/                   # Unit tests
    ├── identity.test.ts
    ├── queries.test.ts
    ├── rbac.test.ts
    └── service-access.test.ts
```

## Role Hierarchy

The system defines 5 roles with the following access patterns:

| Role     | Description                    | Read Access    | Write Access     |
| -------- | ------------------------------ | -------------- | ---------------- |
| Admin    | Full system access             | All services   | All services     |
| Owner    | Project ownership level        | All services\* | Owned services   |
| Editor   | Can edit translations          | All services\* | All services\*\* |
| Reviewer | Can review and approve content | All services\* | None             |
| Viewer   | Read-only access               | All services   | None             |

\*Via Viewer role inheritance  
\*\*Based on role permissions (may be restricted to owned services in future)

## Service-Level Authorization

### Access Control Flow

```
User Request → Authentication → Role Check → Service Ownership → Resource Access
```

### Service Ownership

Services have an `owners[]` array containing user IDs. Users in this array have full access to the service and all its resources.

### Row-Level Security

The system implements row-level security through query filtering:

1. **Service Table**: Direct ownership check via `owners[]` array
2. **Keys Table**: Filtered by associated service ownership
3. **Translations Table**: Inherit access through key → service relationship

## Access Inheritance Pattern

```
Translation → Key → Service → Authorization
```

### Example Flow

1. User requests translation with ID "trans-123"
2. System looks up: `translation.keyId → key.serviceId → service.owners[]`
3. If user is in `service.owners[]` OR has appropriate role → Access granted
4. Otherwise → Access denied

## Usage Examples

### Basic RBAC Checks

```typescript
import { isAdmin, canEdit, canView } from "~/lib/auth/rbac";

// Check if user has specific role
if (isAdmin(user)) {
  // Admin-only functionality
}

// Check if user can perform action
if (canEdit(user)) {
  // Allow editing
}
```

### Service-Level Access

```typescript
import { validateServiceAccess, canAccessService } from "~/lib/auth/rbac";
import { PERMISSIONS } from "~/lib/auth/rbac";

// Check if user can access specific service
const canAccess = await canAccessService(user, serviceId, PERMISSIONS.READ);

// Validate service access (with database lookup)
const hasAccess = await validateServiceAccess(user, serviceId, PERMISSIONS.WRITE);
```

### Query Filtering

```typescript
import { addKeyServiceAccessFilter } from "~/lib/auth/service-access";

// Apply service-level filtering to keys query
let query = db.select().from(l10nKey);
query = addKeyServiceAccessFilter(query, user, PERMISSIONS.READ);
const results = await query.limit(100);
```

### Translation Access

```typescript
import { translationAuthHelpers } from "~/lib/auth/translation-access";

// Check translation access
const canRead = await translationAuthHelpers.canReadTranslation(user, translationId);
const canWrite = await translationAuthHelpers.canWriteTranslation(user, translationId);
const canCreate = await translationAuthHelpers.canCreateTranslationForKey(user, keyId);
```

## API Route Integration

### Standard Pattern

```typescript
import { createServerFileRoute } from "@tanstack/react-start/server";
import { createForbiddenResponse, PERMISSIONS } from "~/lib/auth/rbac";
import { validateServiceAccess } from "~/lib/auth/service-access";

export const ServerRoute = createServerFileRoute("/api/resource/").methods({
  GET: async ({ request }) => {
    // 1. Get authenticated user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    // 2. Apply service-level filtering to query
    let query = db.select().from(resource);
    query = addResourceAccessFilter(query, user, PERMISSIONS.READ);

    // 3. Execute query and return results
    const results = await query.limit(100);
    return new Response(JSON.stringify({ items: results }), {
      headers: { "content-type": "application/json" },
    });
  },

  POST: async ({ request }) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);

    // Check service-level write access
    const { serviceId } = parsed.data;
    const hasAccess = await validateServiceAccess(user, serviceId, PERMISSIONS.WRITE);
    if (!hasAccess) {
      return createForbiddenResponse("You don't have permission to modify this service");
    }

    // Perform the operation
    await db.insert(resource).values(parsed.data);
    return new Response(null, { status: 201 });
  },
});
```

## Security Considerations

### Input Validation

- Always validate request parameters with Zod schemas
- Sanitize user inputs before database operations
- Use parameterized queries (Drizzle handles this automatically)

### Error Handling

- Never leak sensitive information in error messages
- Use consistent error response formats
- Log security events for monitoring

### Database Security

- Use transactions for multi-table operations
- Implement proper foreign key constraints
- Regularly audit service ownership assignments

## Testing Strategy

### Unit Tests

- Test individual RBAC functions
- Mock database calls for service access functions
- Validate permission constants and role hierarchies

### Integration Tests

- Test full request flow through auth middleware
- Validate service filtering with actual database
- Test error conditions and edge cases

### Test Data Setup

```typescript
const testUsers = {
  admin: { id: "admin-1", roles: ["Admin"] },
  owner: { id: "owner-1", roles: ["Owner"] },
  editor: { id: "editor-1", roles: ["Editor", "Viewer"] },
  viewer: { id: "viewer-1", roles: ["Viewer"] },
};

const testServices = {
  ownedByEditor: { id: "service-1", owners: ["editor-1"] },
  ownedByOther: { id: "service-2", owners: ["other-user"] },
};
```

## Migration Guide

### Adding New Roles

1. Update role constants in `rbac.ts`
2. Add role-specific helper functions
3. Update access control matrices
4. Add comprehensive tests
5. Update documentation

### Adding New Resources

1. Create resource-specific access module (following `translation-access.ts` pattern)
2. Implement query filtering functions
3. Add route authorization
4. Create tests for access patterns

## Troubleshooting

### Common Issues

1. **"Access Denied" for valid users**: Check service ownership assignments
2. **Query returns empty results**: Verify access filtering is applied correctly
3. **Role checks failing**: Ensure user roles are properly set in JWT/session

### Debug Helpers

```typescript
// Log user permissions for debugging
console.log("User roles:", user.roles);
console.log("Service owners:", await getServiceOwners(serviceId));
console.log(
  "Access check result:",
  await validateServiceAccess(user, serviceId, permission),
);
```
