import { createMiddleware } from "@tanstack/react-start";
import { getWebRequest, setResponseStatus } from "@tanstack/react-start/server";
import { auth } from "~/lib/auth/auth";
import { verifyIdentityJWT, type IdentityUser } from "~/lib/auth/identity";

// https://tanstack.com/start/latest/docs/framework/react/middleware
// This is a sample middleware that you can use in your server functions.

/**
 * Middleware to force authentication on a server function, and add the user to the context.
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
      const normalized: IdentityUser = {
        sub: String(session.user.id),
        email: session.user.email,
        app_metadata: undefined,
        user_metadata: undefined,
        roles: undefined,
      };
      return next({ context: { user: normalized } });
    }

    setResponseStatus(401);
    throw new Error("Unauthorized");
  },
);
