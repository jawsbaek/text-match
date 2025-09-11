import { serverOnly } from "@tanstack/react-start";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "~/env/server";

// Netlify Identity (GoTrue) JWT verification helper
// Usage: await verifyIdentityJWT(authorizationHeaderValue)

const getJwks = serverOnly(() => {
  const site = env.NETLIFY_IDENTITY_SITE;
  if (!site) {
    throw new Error("NETLIFY_IDENTITY_SITE not configured");
  }
  const jwksUrl = new URL("/.well-known/jwks.json", site).toString();
  return createRemoteJWKSet(new URL(jwksUrl));
});

export type IdentityUser = {
  sub: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  roles?: string[];
};

// Type for JWT payload structure from Netlify Identity
type NetlifyJWTPayload = {
  sub: string;
  email?: string;
  app_metadata?: {
    roles?: string[];
    [key: string]: unknown;
  };
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export async function verifyIdentityJWT(
  authHeader: string | null,
): Promise<IdentityUser | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const audience = env.NETLIFY_IDENTITY_AUD;
  const issuer = env.NETLIFY_IDENTITY_SITE;

  // Return null if Netlify Identity is not configured
  if (!issuer) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, await getJwks(), {
      audience: audience || undefined,
      issuer: issuer || undefined,
    });

    const typedPayload = payload as NetlifyJWTPayload;
    const roles = Array.isArray(typedPayload.app_metadata?.roles)
      ? typedPayload.app_metadata.roles
      : undefined;

    return {
      sub: String(typedPayload.sub),
      email: typeof typedPayload.email === "string" ? typedPayload.email : undefined,
      app_metadata: typedPayload.app_metadata,
      user_metadata: typedPayload.user_metadata,
      roles,
    };
  } catch (error) {
    // Log JWT verification errors but return null to allow fallback to session auth
    console.error("JWT verification failed:", error);
    return null;
  }
}
