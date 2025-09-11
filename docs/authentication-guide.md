# Authentication Guide

This guide documents the authentication patterns and usage for the text-match application.

## Overview

The application uses a dual authentication system with automatic fallback:

1. **Primary**: Netlify Identity (GoTrue) with JWT tokens
2. **Fallback**: Better-Auth session-based authentication

Both methods provide role-based access control (RBAC) with the same user interface.

## Architecture

### Authentication Flow

```
Client Request
     ↓
1. Check Authorization header for Bearer token
     ↓
2. Verify JWT with Netlify Identity (if token present)
     ↓ (if JWT verification fails or no token)
3. Check better-auth session cookie
     ↓ (if session exists)
4. Query user roles from database
     ↓
5. Normalize user context
     ↓
6. Proceed with authenticated request
```

### User Context

All authenticated requests receive a normalized `IdentityUser` object:

```typescript
interface IdentityUser {
  sub: string; // User ID
  email?: string; // User email
  app_metadata?: Record<string, unknown>; // JWT metadata (Netlify Identity only)
  user_metadata?: Record<string, unknown>; // JWT user data (Netlify Identity only)
  roles?: string[]; // User roles array
}
```

## Implementation Patterns

### 1. Protected API Routes

Current pattern for protecting API routes:

```typescript
import { createServerFileRoute } from "@tanstack/react-start/server";
import { verifyIdentityJWT } from "~/lib/auth/identity";
import { auth } from "~/lib/auth/auth";
import { canEdit, createForbiddenResponse } from "~/lib/auth/rbac";

export const ServerRoute = createServerFileRoute("/api/keys/").methods({
  GET: async ({ request }: { request: Request }) => {
    // 1. Check JWT authentication first
    const headers = request.headers;
    const bearer = headers.get("authorization");
    let user = await verifyIdentityJWT(bearer);

    // 2. Fallback to session authentication
    if (!user) {
      const session = await auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      });
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      // Session auth provides a normalized user context with DB-queried roles
    }

    // 3. Optional: Role-based access control
    if (!canEdit(user)) {
      return createForbiddenResponse("Editor role required");
    }

    // 4. Protected logic here
    // ...your business logic...

    return new Response(JSON.stringify({ data: "success" }), {
      headers: { "content-type": "application/json" },
    });
  },
});
```

### 2. Role-Based Access Control

Use the RBAC helper functions for permission checks:

```typescript
import {
  hasRole,
  hasAnyRole,
  isAdmin,
  canEdit,
  canReview,
  canView,
  createForbiddenResponse,
} from "~/lib/auth/rbac";

// Basic role checking
if (hasRole(user, "Admin")) {
  // Admin-specific logic
}

// Multiple role checking
if (hasAnyRole(user, ["Admin", "Owner"])) {
  // Admin or Owner logic
}

// Convenience functions
if (isAdmin(user)) {
  // Full access
} else if (canEdit(user)) {
  // Admin, Owner, or Editor
} else if (canReview(user)) {
  // Admin, Owner, Editor, or Reviewer
} else if (canView(user)) {
  // Any authenticated user with roles
} else {
  return createForbiddenResponse();
}
```

### 3. Available Roles

The system supports these roles (defined in Story 1.1):

| Role       | Permissions                   | Use Case              |
| ---------- | ----------------------------- | --------------------- |
| `Admin`    | Full system access            | System administrators |
| `Owner`    | Project-level ownership       | Project owners        |
| `Editor`   | Edit translations and content | Content editors       |
| `Reviewer` | Review and approve content    | Content reviewers     |
| `Viewer`   | Read-only access              | Read-only users       |

### 4. Environment Configuration

Required environment variables:

```bash
# Required for all authentication
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=your-secret-key

# Optional - Netlify Identity (if not set, falls back to session auth)
NETLIFY_IDENTITY_SITE=https://your-site.netlify.app
NETLIFY_IDENTITY_AUD=your-audience-id
```

## Testing Patterns

### Unit Testing Auth Functions

```typescript
import { describe, expect, it } from "vitest";
import { hasRole, canEdit } from "~/lib/auth/rbac";
import type { IdentityUser } from "~/lib/auth/identity";

describe("RBAC Tests", () => {
  const testUser: IdentityUser = {
    sub: "user123",
    email: "test@example.com",
    roles: ["Editor", "Viewer"],
  };

  it("should check roles correctly", () => {
    expect(hasRole(testUser, "Editor")).toBe(true);
    expect(hasRole(testUser, "Admin")).toBe(false);
    expect(canEdit(testUser)).toBe(true);
  });
});
```

### Integration Testing Protected Routes

```typescript
import { describe, expect, it } from "vitest";
import { verifyIdentityJWT } from "~/lib/auth/identity";

describe("Auth Integration", () => {
  it("should return 401 for unauthenticated requests", async () => {
    // Test that routes properly reject unauthenticated requests
    const result = await verifyIdentityJWT(null);
    expect(result).toBeNull();
  });

  it("should handle invalid tokens gracefully", async () => {
    const result = await verifyIdentityJWT("Bearer invalid-token");
    expect(result).toBeNull(); // Should not crash
  });
});
```

## Error Handling

### Common Response Patterns

```typescript
// 401 Unauthorized (no valid authentication)
return new Response(JSON.stringify({ error: "Unauthorized" }), {
  status: 401,
  headers: { "content-type": "application/json" },
});

// 403 Forbidden (authenticated but insufficient permissions)
return createForbiddenResponse("Admin role required");

// Custom 403 message
return createForbiddenResponse("You need Editor access to modify translations");
```

### Graceful Degradation

The authentication system is designed to degrade gracefully:

1. **Missing Environment Variables**: JWT verification returns `null`, falls back to session auth
2. **Invalid JWT Tokens**: Logged and ignored, falls back to session auth
3. **Database Errors**: User roles default to empty array, logged for monitoring
4. **Session Failures**: Return 401, user must re-authenticate

## Security Considerations

### JWT Validation

- **Issuer Verification**: JWT `iss` claim must match `NETLIFY_IDENTITY_SITE`
- **Audience Verification**: JWT `aud` claim must match `NETLIFY_IDENTITY_AUD` (if configured)
- **Signature Verification**: Uses Netlify's JWKS endpoint for key validation
- **Role Extraction**: Safely extracts roles from `app_metadata.roles` array

### Session Security

- **Cookie Security**: Better-auth handles secure cookie settings
- **Session Expiration**: Configurable session timeouts
- **CSRF Protection**: Built into better-auth session handling

### Role Security

- **Database-Backed**: Session auth roles come from database, not client
- **Principle of Least Privilege**: Default to no access, explicit role grants
- **Role Validation**: All role checks handle undefined/null users safely

## Troubleshooting

### Common Issues

1. **"NETLIFY_IDENTITY_SITE not configured"**
   - Set the environment variable or accept session-only auth
   - The system will fall back to better-auth sessions

2. **"JWT verification failed"**
   - Check that the JWT is valid and from the correct issuer
   - Verify environment variables match your Netlify Identity settings

3. **User has no roles**
   - Check the `permission` table for user role assignments
   - Ensure roles exist in the `role` table
   - For JWT auth, check `app_metadata.roles` in Netlify Identity

4. **401 on authenticated requests**
   - Verify the Authorization header format: `Bearer <token>`
   - Check that session cookies are being sent
   - Ensure the user exists in the database for session auth

### Debug Logging

The system logs authentication failures to help with debugging:

```typescript
// JWT verification failures are logged
console.error("JWT verification failed:", error);

// Database role query failures are logged
console.error("Failed to fetch user roles:", error);
```

## Migration Notes

### From Previous Auth Systems

If migrating from a different authentication system:

1. **User Data**: Import users into the `user` table
2. **Role Mapping**: Create entries in `role` and `permission` tables
3. **Environment**: Configure both Netlify Identity and better-auth
4. **Testing**: Verify both JWT and session authentication paths work

### Future Enhancements

The current architecture supports these future enhancements:

- **Service-Scoped Permissions**: The `permission` table includes `serviceId` for per-service roles
- **Additional Auth Providers**: Better-auth supports OAuth providers (GitHub, Google)
- **API Key Authentication**: Could be added as a third authentication method
- **Role Hierarchies**: Database structure supports nested role relationships
