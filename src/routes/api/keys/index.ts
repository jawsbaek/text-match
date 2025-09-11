import { createServerFileRoute } from "@tanstack/react-start/server";
import { and, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { auth } from "~/lib/auth/auth";
import { verifyIdentityJWT, type IdentityUser } from "~/lib/auth/identity";
import { createForbiddenResponse, PERMISSIONS } from "~/lib/auth/rbac";
import { validateServiceAccess } from "~/lib/auth/service-access";
import { db } from "~/lib/db";
import { l10nKey, service as serviceTbl } from "~/lib/db/schema";

export const createKeySchema = z.object({
  id: z.string().min(1),
  keyName: z.string().min(1),
  serviceCode: z.string().min(1).optional(),
  namespaceId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Get authenticated user from request headers
 * @param request - The request object
 * @returns Promise<IdentityUser | null> - The authenticated user or null
 */
async function getAuthenticatedUser(request: Request): Promise<IdentityUser | null> {
  const headers = request.headers;
  const bearer = headers.get("authorization");
  const identityUser = await verifyIdentityJWT(bearer);

  if (identityUser) {
    return identityUser;
  }

  // Try better-auth session as fallback
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });

  if (session?.user) {
    // Convert better-auth user to IdentityUser format
    return {
      sub: session.user.id,
      email: session.user.email,
      roles: ["Viewer"], // Default role for better-auth users
    };
  }

  return null;
}

// Create a server route with manual auth checking
export const ServerRoute = createServerFileRoute("/api/keys/").methods({
  GET: async ({ request }: { request: Request }) => {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const prefix = url.searchParams.get("prefix") || undefined;
    const serviceCode = url.searchParams.get("service") || undefined;

    const conds: SQL<unknown>[] = [];

    // Apply service-level access control for read permission
    // For non-admin users who don't have view role, restrict to owned services
    if (!user.roles?.includes("Admin") && !user.roles?.includes("Viewer")) {
      // This user can only see keys from services they own
      const ownedServices = await db
        .select({ id: serviceTbl.id })
        .from(serviceTbl)
        .where(sql`${user.sub} = ANY(${serviceTbl.owners})`);

      if (ownedServices.length > 0) {
        const ownedServiceIds = ownedServices.map((s) => s.id);
        // Add service access filter - either owned services or null service keys
        conds.push(
          or(
            inArray(l10nKey.serviceId, ownedServiceIds),
            sql`${l10nKey.serviceId} IS NULL`,
          )!,
        );
      } else {
        // User owns no services, can only see keys without service association
        conds.push(sql`${l10nKey.serviceId} IS NULL`);
      }
    }

    if (prefix) {
      conds.push(ilike(l10nKey.keyName, `${prefix}%`));
    }
    if (serviceCode) {
      // join service by code
      const svc = await db.query.service.findFirst({
        where: eq(serviceTbl.code, serviceCode),
      });
      if (svc) {
        conds.push(eq(l10nKey.serviceId, svc.id));
      }
    }

    // Execute query with all conditions
    const rows = conds.length
      ? await db
          .select()
          .from(l10nKey)
          .where(and(...conds))
          .limit(100)
      : await db.select().from(l10nKey).limit(100);

    return new Response(JSON.stringify({ items: rows }), {
      headers: { "content-type": "application/json" },
    });
  },
  POST: async ({ request }: { request: Request }) => {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: z.treeifyError(parsed.error) }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const { id, keyName, serviceCode, namespaceId, tags } = parsed.data;

    let serviceId: string | null = null;
    if (serviceCode) {
      const svc = await db.query.service.findFirst({
        where: eq(serviceTbl.code, serviceCode),
      });
      if (!svc) {
        return new Response(JSON.stringify({ error: "service not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      serviceId = svc.id;

      // Check if user has write access to this service
      const hasAccess = await validateServiceAccess(user, serviceId, PERMISSIONS.WRITE);
      if (!hasAccess) {
        return createForbiddenResponse(
          "You don't have permission to create keys for this service",
        );
      }
    } else {
      // For keys without a service, only allow users with edit permissions
      // This handles legacy data or system-wide keys
      if (!user.roles?.includes("Admin") && !user.roles?.includes("Editor")) {
        return createForbiddenResponse(
          "You need Editor role or higher to create keys without a service",
        );
      }
    }

    await db.insert(l10nKey).values({
      id,
      keyName,
      serviceId,
      namespaceId: namespaceId ?? null,
      tags: tags ?? [],
    });
    return new Response(null, { status: 201 });
  },
});
