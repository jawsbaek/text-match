import { createMiddleware } from "@tanstack/react-start";
import { getWebRequest, setResponseStatus } from "@tanstack/react-start/server";
import { auth } from "~/lib/auth/auth";
import { verifyIdentityJWT, type IdentityUser } from "~/lib/auth/identity";
import { getUserRoles } from "~/lib/auth/queries";

// https://tanstack.com/start/latest/docs/framework/react/middleware

/**
 * Authentication middleware for TanStack Start server functions.
 *
 * This middleware enforces authentication and adds the authenticated user to the context.
 * It supports two authentication methods with automatic fallback:
 *
 * 1. **Netlify Identity (Primary)**: Verifies JWT tokens from Netlify Identity (GoTrue)
 *    - Extracts roles from `app_metadata.roles` in the JWT payload
 *    - Validates issuer and audience claims against environment variables
 *
 * 2. **Better-Auth Session (Fallback)**: Uses better-auth session cookies
 *    - Queries user roles from the database using the `permission` and `role` tables
 *    - Normalizes the user context to match the IdentityUser interface
 *
 * @throws {Error} Returns 401 Unauthorized if both authentication methods fail
 *
 * @example
 * ```typescript
 * // Apply to server routes
 * export const ServerRoute = createServerFileRoute("/api/protected/")
 *   .methods({
 *     GET: async ({ request }) => {
 *       // Manual auth checking (current pattern)
 *       const headers = request.headers;
 *       const bearer = headers.get("authorization");
 *       const identityUser = await verifyIdentityJWT(bearer);
 *
 *       if (!identityUser) {
 *         const session = await auth.api.getSession({ headers });
 *         if (!session) {
 *           return new Response(JSON.stringify({ error: "Unauthorized" }), {
 *             status: 401,
 *             headers: { "content-type": "application/json" },
 *           });
 *         }
 *       }
 *
 *       // Your protected logic here
 *       return new Response(JSON.stringify({ data: "protected" }), {
 *         headers: { "content-type": "application/json" },
 *       });
 *     }
 *   });
 * ```
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const headers = getWebRequest().headers;
    // Prefer Netlify Identity Bearer token if present, else fall back to better-auth session
    const bearer = headers.get("authorization");
    const identityUser = await verifyIdentityJWT(bearer);

    if (identityUser) {
      return next({ context: { user: identityUser satisfies IdentityUser } });
    }

    const session = await auth.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    if (session) {
      // Fetch user roles from database for session-based auth
      const roles = await getUserRoles(String(session.user.id));

      const normalized: IdentityUser = {
        sub: String(session.user.id),
        email: session.user.email,
        app_metadata: undefined,
        user_metadata: undefined,
        roles: roles.length > 0 ? roles : undefined,
      };
      return next({ context: { user: normalized } });
    }

    setResponseStatus(401);
    throw new Error("Unauthorized");
  },
);
