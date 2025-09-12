import { createServerFileRoute } from "@tanstack/react-start/server";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";

import { auth } from "~/lib/auth/auth";
import { verifyIdentityJWT, type IdentityUser } from "~/lib/auth/identity";
import { createForbiddenResponse, PERMISSIONS } from "~/lib/auth/rbac";
import { validateServiceAccess } from "~/lib/auth/service-access";
import { db } from "~/lib/db";
import { event, l10nKey, service as serviceTbl, translation } from "~/lib/db/schema";

// Zod schema for export query parameters
export const exportQuerySchema = z.object({
  format: z.enum(["json"]).default("json"),
  service: z.string().min(1),
  locales: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  includeEmpty: z.coerce.boolean().default(false),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;

// Type for export data format - matches import schema for round-trip compatibility
export interface ExportData {
  service: string;
  locales: string[];
  exportedAt: string;
  data: {
    keys: Array<{
      id: string;
      keyName: string;
      namespaceId?: string;
      tags: string[];
      status: string;
      translations: Array<{
        locale: string;
        value: string;
        status: string;
        version: number;
      }>;
    }>;
  };
}

/**
 * Get authenticated user from request headers
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

/**
 * Generate export data with filtering
 */
async function generateExportData(
  serviceId: string,
  serviceCode: string,
  options: {
    locales?: string[];
    status?: string;
    includeEmpty: boolean;
  },
): Promise<ExportData> {
  const { locales, status, includeEmpty } = options;

  // Build conditions for key filtering
  const keyConds: SQL<unknown>[] = [eq(l10nKey.serviceId, serviceId)];

  if (status) {
    keyConds.push(eq(l10nKey.status, status as "draft" | "active" | "archived"));
  }

  // Build conditions for translation filtering
  const translationConds: SQL<unknown>[] = [];

  if (locales && locales.length > 0) {
    translationConds.push(
      inArray(
        translation.locale,
        locales as (
          | "en"
          | "es"
          | "fr"
          | "de"
          | "it"
          | "pt"
          | "ru"
          | "ja"
          | "ko"
          | "zh"
          | "ar"
          | "hi"
        )[],
      ),
    );
  }

  if (status) {
    translationConds.push(
      eq(translation.status, status as "draft" | "active" | "archived"),
    );
  }

  // Get keys with their translations
  let keysWithTranslations;

  if (includeEmpty) {
    // Include keys without translations using LEFT JOIN
    const baseQuery = db
      .select({
        key: l10nKey,
        translation: translation,
      })
      .from(l10nKey)
      .leftJoin(translation, eq(l10nKey.id, translation.keyId));

    // Combine all conditions
    const allConds = [...keyConds];
    if (translationConds.length > 0) {
      allConds.push(...translationConds);
    }

    const finalQuery =
      allConds.length > 0 ? baseQuery.where(and(...allConds)) : baseQuery;

    keysWithTranslations = await finalQuery;
  } else {
    // Only include keys that have translations using INNER JOIN
    const baseQuery = db
      .select({
        key: l10nKey,
        translation: translation,
      })
      .from(l10nKey)
      .innerJoin(translation, eq(l10nKey.id, translation.keyId));

    const allConds = [...keyConds, ...translationConds];
    const finalQuery =
      allConds.length > 0 ? baseQuery.where(and(...allConds)) : baseQuery;

    keysWithTranslations = await finalQuery;
  }

  // Group by key and aggregate translations
  const keyMap = new Map<
    string,
    {
      id: string;
      keyName: string;
      namespaceId?: string;
      tags: string[];
      status: string;
      translations: Array<{
        locale: string;
        value: string;
        status: string;
        version: number;
      }>;
    }
  >();

  for (const row of keysWithTranslations) {
    const key = row.key;
    const trans = row.translation;

    if (!keyMap.has(key.id)) {
      keyMap.set(key.id, {
        id: key.id,
        keyName: key.keyName,
        namespaceId: key.namespaceId || undefined,
        tags: key.tags,
        status: key.status,
        translations: [],
      });
    }

    // Add translation if it exists (not null from LEFT JOIN)
    if (trans) {
      keyMap.get(key.id)!.translations.push({
        locale: trans.locale,
        value: trans.value || "",
        status: trans.status,
        version: trans.version,
      });
    }
  }

  const keys = Array.from(keyMap.values());

  // Sort keys by keyName for consistent output
  keys.sort((a, b) => a.keyName.localeCompare(b.keyName));

  // Sort translations within each key by locale
  for (const key of keys) {
    key.translations.sort((a, b) => a.locale.localeCompare(b.locale));
  }

  return {
    service: serviceCode,
    locales: locales || [],
    exportedAt: new Date().toISOString(),
    data: {
      keys,
    },
  };
}

export const ServerRoute = createServerFileRoute("/api/export").methods({
  GET: async ({ request }: { request: Request }) => {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const parsed = exportQuerySchema.safeParse(queryParams);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: z.treeifyError(parsed.error) }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const {
      format,
      service: serviceCode,
      locales: localesParam,
      status,
      includeEmpty,
    } = parsed.data;

    // Parse locales parameter (comma-separated)
    const locales = localesParam
      ? localesParam
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean)
      : undefined;

    // Validate locales if provided
    const validLocales = [
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
    ];
    if (locales) {
      const invalidLocales = locales.filter((locale) => !validLocales.includes(locale));
      if (invalidLocales.length > 0) {
        return new Response(
          JSON.stringify({
            error: `Invalid locales: ${invalidLocales.join(`, `)}`,
            validLocales,
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // Resolve service by code
    const svc = await db.query.service.findFirst({
      where: eq(serviceTbl.code, serviceCode),
    });

    if (!svc) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    // Check if user has read access to this service
    const hasAccess = await validateServiceAccess(user, svc.id, PERMISSIONS.READ);
    if (!hasAccess) {
      return createForbiddenResponse(
        "You don't have permission to export data from this service",
      );
    }

    try {
      // Generate export data
      const exportData = await generateExportData(svc.id, serviceCode, {
        locales,
        status,
        includeEmpty,
      });

      // Log export operation
      await db.insert(event).values({
        id: crypto.randomUUID(),
        actor: user.sub,
        action: "export",
        entityType: "service",
        entityId: svc.id,
        before: null,
        after: {
          service: serviceCode,
          locales: locales || [],
          status: status || "all",
          includeEmpty,
          keysExported: exportData.data.keys.length,
          translationsExported: exportData.data.keys.reduce(
            (sum, key) => sum + key.translations.length,
            0,
          ),
        },
      });

      // Determine content type and response based on format
      if (format === "json") {
        return new Response(JSON.stringify(exportData, null, 2), {
          headers: {
            "content-type": "application/json",
            "content-disposition": `attachment; filename="${serviceCode}-export-${new Date().toISOString().split("T")[0]}.json"`,
          },
        });
      }

      // This shouldn't happen due to schema validation, but just in case
      return new Response(JSON.stringify({ error: "Unsupported format" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Export operation failed:", error);

      return new Response(
        JSON.stringify({
          error: "Export operation failed",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  },
});
