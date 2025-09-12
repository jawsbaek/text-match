import { createServerFileRoute } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { importPayloadSchema, type ImportPayload } from "~/lib/api/import-export-types";
import { auth } from "~/lib/auth/auth";
import { verifyIdentityJWT, type IdentityUser } from "~/lib/auth/identity";
import { createForbiddenResponse, PERMISSIONS } from "~/lib/auth/rbac";
import { validateServiceAccess } from "~/lib/auth/service-access";
import { db } from "~/lib/db";
import { event, l10nKey, service as serviceTbl, translation } from "~/lib/db/schema";

// Schema and types imported from side-effect-free module

// Type for diff report
export interface DiffReport {
  summary: {
    keysToCreate: number;
    keysToUpdate: number;
    translationsToCreate: number;
    translationsToUpdate: number;
  };
  changes: Array<{
    type: "create_key" | "update_key" | "create_translation" | "update_translation";
    keyId: string;
    keyName: string;
    locale?: string;
    before?: unknown;
    after: unknown;
  }>;
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
 * Generate diff report for dry-run mode
 */
async function generateDiffReport(
  serviceId: string,
  importData: ImportPayload["data"],
): Promise<DiffReport> {
  const changes: DiffReport["changes"] = [];
  let keysToCreate = 0;
  let keysToUpdate = 0;
  let translationsToCreate = 0;
  let translationsToUpdate = 0;

  // Get existing keys for this service
  const existingKeys = await db.query.l10nKey.findMany({
    where: eq(l10nKey.serviceId, serviceId),
    with: {
      translations: true,
    },
  });

  const existingKeyMap = new Map(existingKeys.map((key) => [key.id, key]));

  for (const keyData of importData.keys) {
    const existingKey = existingKeyMap.get(keyData.id);

    if (!existingKey) {
      // Key doesn't exist - will be created
      keysToCreate++;
      changes.push({
        type: "create_key",
        keyId: keyData.id,
        keyName: keyData.keyName,
        after: {
          keyName: keyData.keyName,
          namespaceId: keyData.namespaceId,
          tags: keyData.tags,
          status: keyData.status,
        },
      });

      // All translations for new key will be created
      translationsToCreate += keyData.translations.length;
      for (const translation of keyData.translations) {
        changes.push({
          type: "create_translation",
          keyId: keyData.id,
          keyName: keyData.keyName,
          locale: translation.locale,
          after: {
            locale: translation.locale,
            value: translation.value,
            status: translation.status,
            version: translation.version,
          },
        });
      }
    } else {
      // Key exists - check for updates
      const keyChanged =
        existingKey.keyName !== keyData.keyName ||
        existingKey.namespaceId !== keyData.namespaceId ||
        JSON.stringify(existingKey.tags) !== JSON.stringify(keyData.tags) ||
        existingKey.status !== keyData.status;

      if (keyChanged) {
        keysToUpdate++;
        changes.push({
          type: "update_key",
          keyId: keyData.id,
          keyName: keyData.keyName,
          before: {
            keyName: existingKey.keyName,
            namespaceId: existingKey.namespaceId,
            tags: existingKey.tags,
            status: existingKey.status,
          },
          after: {
            keyName: keyData.keyName,
            namespaceId: keyData.namespaceId,
            tags: keyData.tags,
            status: keyData.status,
          },
        });
      }

      // Check translations
      const existingTranslationMap = new Map(
        existingKey.translations.map((t) => [t.locale, t]),
      );

      for (const translationData of keyData.translations) {
        const existingTranslation = existingTranslationMap.get(translationData.locale);

        if (!existingTranslation) {
          translationsToCreate++;
          changes.push({
            type: "create_translation",
            keyId: keyData.id,
            keyName: keyData.keyName,
            locale: translationData.locale,
            after: {
              locale: translationData.locale,
              value: translationData.value,
              status: translationData.status,
              version: translationData.version,
            },
          });
        } else {
          // Translation exists - check for updates
          const translationChanged =
            existingTranslation.value !== translationData.value ||
            existingTranslation.status !== translationData.status ||
            existingTranslation.version !== translationData.version;

          if (translationChanged) {
            translationsToUpdate++;
            changes.push({
              type: "update_translation",
              keyId: keyData.id,
              keyName: keyData.keyName,
              locale: translationData.locale,
              before: {
                locale: existingTranslation.locale,
                value: existingTranslation.value,
                status: existingTranslation.status,
                version: existingTranslation.version,
              },
              after: {
                locale: translationData.locale,
                value: translationData.value,
                status: translationData.status,
                version: translationData.version,
              },
            });
          }
        }
      }
    }
  }

  return {
    summary: {
      keysToCreate,
      keysToUpdate,
      translationsToCreate,
      translationsToUpdate,
    },
    changes,
  };
}

/**
 * Execute import with database transaction
 */
async function executeImport(
  serviceId: string,
  importData: ImportPayload["data"],
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Get existing keys for this service
    const existingKeys = await tx.query.l10nKey.findMany({
      where: eq(l10nKey.serviceId, serviceId),
      with: {
        translations: true,
      },
    });

    const existingKeyMap = new Map(existingKeys.map((key) => [key.id, key]));

    for (const keyData of importData.keys) {
      const existingKey = existingKeyMap.get(keyData.id);

      if (!existingKey) {
        // Create new key
        await tx.insert(l10nKey).values({
          id: keyData.id,
          serviceId,
          keyName: keyData.keyName,
          namespaceId: keyData.namespaceId ?? null,
          tags: keyData.tags,
          status: keyData.status,
        });

        // Log key creation event
        await tx.insert(event).values({
          id: crypto.randomUUID(),
          actor: userId,
          action: "create",
          entityType: "l10n_key",
          entityId: keyData.id,
          before: null,
          after: {
            keyName: keyData.keyName,
            serviceId,
            namespaceId: keyData.namespaceId,
            tags: keyData.tags,
            status: keyData.status,
          },
        });

        // Create translations for new key
        for (const translationData of keyData.translations) {
          const translationId = crypto.randomUUID();
          await tx.insert(translation).values({
            id: translationId,
            keyId: keyData.id,
            locale: translationData.locale,
            value: translationData.value,
            status: translationData.status,
            version: translationData.version,
          });

          // Log translation creation event
          await tx.insert(event).values({
            id: crypto.randomUUID(),
            actor: userId,
            action: "create",
            entityType: "translation",
            entityId: translationId,
            before: null,
            after: {
              keyId: keyData.id,
              locale: translationData.locale,
              value: translationData.value,
              status: translationData.status,
              version: translationData.version,
            },
          });
        }
      } else {
        // Update existing key if changed
        const keyChanged =
          existingKey.keyName !== keyData.keyName ||
          existingKey.namespaceId !== keyData.namespaceId ||
          JSON.stringify(existingKey.tags) !== JSON.stringify(keyData.tags) ||
          existingKey.status !== keyData.status;

        if (keyChanged) {
          const beforeState = {
            keyName: existingKey.keyName,
            namespaceId: existingKey.namespaceId,
            tags: existingKey.tags,
            status: existingKey.status,
          };

          await tx
            .update(l10nKey)
            .set({
              keyName: keyData.keyName,
              namespaceId: keyData.namespaceId,
              tags: keyData.tags,
              status: keyData.status,
            })
            .where(eq(l10nKey.id, keyData.id));

          // Log key update event
          await tx.insert(event).values({
            id: crypto.randomUUID(),
            actor: userId,
            action: "update",
            entityType: "l10n_key",
            entityId: keyData.id,
            before: beforeState,
            after: {
              keyName: keyData.keyName,
              namespaceId: keyData.namespaceId,
              tags: keyData.tags,
              status: keyData.status,
            },
          });
        }

        // Handle translations
        const existingTranslationMap = new Map(
          existingKey.translations.map((t) => [t.locale, t]),
        );

        for (const translationData of keyData.translations) {
          const existingTranslation = existingTranslationMap.get(translationData.locale);

          if (!existingTranslation) {
            // Create new translation
            const translationId = crypto.randomUUID();
            await tx.insert(translation).values({
              id: translationId,
              keyId: keyData.id,
              locale: translationData.locale,
              value: translationData.value,
              status: translationData.status,
              version: translationData.version,
            });

            // Log translation creation event
            await tx.insert(event).values({
              id: crypto.randomUUID(),
              actor: userId,
              action: "create",
              entityType: "translation",
              entityId: translationId,
              before: null,
              after: {
                keyId: keyData.id,
                locale: translationData.locale,
                value: translationData.value,
                status: translationData.status,
                version: translationData.version,
              },
            });
          } else {
            // Update existing translation if changed
            const translationChanged =
              existingTranslation.value !== translationData.value ||
              existingTranslation.status !== translationData.status ||
              existingTranslation.version !== translationData.version;

            if (translationChanged) {
              const beforeState = {
                locale: existingTranslation.locale,
                value: existingTranslation.value,
                status: existingTranslation.status,
                version: existingTranslation.version,
              };

              await tx
                .update(translation)
                .set({
                  value: translationData.value,
                  status: translationData.status,
                  version: translationData.version,
                })
                .where(eq(translation.id, existingTranslation.id));

              // Log translation update event
              await tx.insert(event).values({
                id: crypto.randomUUID(),
                actor: userId,
                action: "update",
                entityType: "translation",
                entityId: existingTranslation.id,
                before: beforeState,
                after: {
                  locale: translationData.locale,
                  value: translationData.value,
                  status: translationData.status,
                  version: translationData.version,
                },
              });
            }
          }
        }
      }
    }
  });
}

export const ServerRoute = createServerFileRoute("/api/import").methods({
  POST: async ({ request }: { request: Request }) => {
    // Get authenticated user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const parsed = importPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: z.treeifyError(parsed.error) }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const { dryRun, service: serviceCode, data: importData } = parsed.data;

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

    // Check if user has write access to this service
    const hasAccess = await validateServiceAccess(user, svc.id, PERMISSIONS.WRITE);
    if (!hasAccess) {
      return createForbiddenResponse(
        "You don't have permission to import data for this service",
      );
    }

    try {
      if (dryRun) {
        // Generate diff report without making changes
        const diffReport = await generateDiffReport(svc.id, importData);

        return new Response(
          JSON.stringify({
            dryRun: true,
            service: serviceCode,
            report: diffReport,
          }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      } else {
        // Execute the import with transaction
        await executeImport(svc.id, importData, user.sub);

        // Log import operation
        await db.insert(event).values({
          id: crypto.randomUUID(),
          actor: user.sub,
          action: "import",
          entityType: "service",
          entityId: svc.id,
          before: null,
          after: {
            service: serviceCode,
            keysCount: importData.keys.length,
            translationsCount: importData.keys.reduce(
              (sum, key) => sum + key.translations.length,
              0,
            ),
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            service: serviceCode,
            imported: {
              keys: importData.keys.length,
              translations: importData.keys.reduce(
                (sum, key) => sum + key.translations.length,
                0,
              ),
            },
          }),
          {
            status: 201,
            headers: { "content-type": "application/json" },
          },
        );
      }
    } catch (error) {
      console.error("Import operation failed:", error);

      return new Response(
        JSON.stringify({
          error: "Import operation failed",
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
