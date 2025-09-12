import { createServerFileRoute } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { logEvent } from "~/lib/audit/event-logger";
import { auth } from "~/lib/auth/auth";
import { verifyIdentityJWT, type IdentityUser } from "~/lib/auth/identity";
import { createForbiddenResponse, PERMISSIONS } from "~/lib/auth/rbac";
import { validateServiceAccess } from "~/lib/auth/service-access";
import { db } from "~/lib/db";
import { translation } from "~/lib/db/schema";

// BCP-47 locale validation schema
export const updateTranslationSchema = z.object({
  locale: z.enum([
    "en",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "ru",
    "ja",
    "ko",
    "zh",
    "ar",
    "hi",
  ]),
  value: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
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

export const ServerRoute = createServerFileRoute("/api/translations/$id").methods({
  PUT: async ({ request, params }) => {
    const { id } = params;
    // Get authenticated user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    if (!id) {
      return new Response(JSON.stringify({ error: "Translation ID is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const parsed = updateTranslationSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: z.treeifyError(parsed.error) }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const { locale, value, status } = parsed.data;

    // Check if translation exists and get associated key/service info
    const existingTranslation = await db.query.translation.findFirst({
      where: eq(translation.id, id),
      with: {
        key: {
          with: {
            service: true,
          },
        },
      },
    });

    if (!existingTranslation) {
      return new Response(JSON.stringify({ error: "Translation not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    // Check service access permissions if the key has a service
    if (existingTranslation.key.serviceId) {
      const hasAccess = await validateServiceAccess(
        user,
        existingTranslation.key.serviceId,
        PERMISSIONS.WRITE,
      );
      if (!hasAccess) {
        return createForbiddenResponse(
          "You don't have permission to modify translations for this service",
        );
      }
    } else {
      // For translations without a service, only allow users with edit permissions
      if (!user.roles?.includes("Admin") && !user.roles?.includes("Editor")) {
        return createForbiddenResponse(
          "You need Editor role or higher to modify translations without a service",
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof translation.$inferInsert> = {};

    if (locale !== undefined) updateData.locale = locale;
    if (value !== undefined) updateData.value = value;
    if (status !== undefined) updateData.status = status;

    // Always update the version and timestamp
    updateData.version = existingTranslation.version + 1;
    updateData.updatedAt = new Date();

    // Capture before state for audit log
    const beforeState = {
      id: existingTranslation.id,
      keyId: existingTranslation.keyId,
      locale: existingTranslation.locale,
      value: existingTranslation.value,
      status: existingTranslation.status,
      version: existingTranslation.version,
    };

    // Update the translation
    await db.update(translation).set(updateData).where(eq(translation.id, id));

    // Capture after state for audit log
    const afterState = {
      ...beforeState,
      ...updateData,
    };

    // Log translation update event
    await logEvent({
      actor: user.sub,
      action: "update",
      entityType: "translation",
      entityId: id,
      before: beforeState,
      after: afterState,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
});
