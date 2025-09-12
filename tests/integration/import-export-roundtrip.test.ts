// import { afterAll, beforeAll, describe, expect, it } from "vitest";
// import { sql, eq } from "drizzle-orm";
// import { l10nKey, service, translation, namespace } from "~/lib/db/schema";
// import { importPayloadSchema, type ImportPayload, type ExportData } from "~/lib/api/import-export-types";
// import { getTestDb, closeTestDb } from "../utils/test-db";

// describe("Import/Export Round-trip Integration", () => {
//   let testServiceId: string;
//   let testNamespaceId: string;
//   let testServiceCode: string;
//   let db: ReturnType<typeof getTestDb>;

//   beforeAll(async () => {
//     db = getTestDb();
//     testServiceCode = `test-${Date.now()}`;

//     testServiceId = crypto.randomUUID();
//     await db.insert(service).values({
//       id: testServiceId,
//       code: testServiceCode,
//       name: "Test Service",
//       owners: ["test-user"],
//     });

//     testNamespaceId = crypto.randomUUID();
//     await db.insert(namespace).values({
//       id: testNamespaceId,
//       serviceId: testServiceId,
//       name: "auth-ns",
//     });
//   });

//   afterAll(async () => {
//     try {
//       await db.execute(sql`DELETE FROM event WHERE actor = 'test-user'`);
//       await db.execute(sql`DELETE FROM translation WHERE key_id LIKE '%test%'`);
//       await db.execute(sql`DELETE FROM l10n_key WHERE id LIKE '%test%'`);
//       await db.execute(sql`DELETE FROM namespace WHERE name = 'auth-ns'`);
//       await db.execute(sql`DELETE FROM service WHERE code = ${testServiceCode}`);
//     } catch (error) {
//       console.warn('Cleanup failed:', error);
//     }
//     await closeTestDb();
//   });

//   it("should maintain data integrity in export-import round-trip", async () => {
//     const keyId = `key-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

//     const originalData: ImportPayload["data"] = {
//       keys: [
//         {
//           id: keyId,
//           keyName: "auth.login.title",
//           namespaceId: testNamespaceId,
//           tags: ["auth"],
//           status: "active",
//           translations: [
//             {
//               locale: "en",
//               value: "Login",
//               status: "active",
//               version: 1,
//             },
//             {
//               locale: "es",
//               value: "Iniciar sesión",
//               status: "active",
//               version: 1,
//             },
//           ],
//         },
//       ],
//     };

//     // Import data
//     await db.transaction(async (tx) => {
//       for (const keyData of originalData.keys) {
//         await tx.insert(l10nKey).values({
//           id: keyData.id,
//           serviceId: testServiceId,
//           keyName: keyData.keyName,
//           namespaceId: keyData.namespaceId ?? null,
//           tags: keyData.tags,
//           status: keyData.status as "draft" | "active" | "archived",
//         });

//         for (const translationData of keyData.translations) {
//           await tx.insert(translation).values({
//             id: crypto.randomUUID(),
//             keyId: keyData.id,
//             locale: translationData.locale as "en" | "es" | "fr" | "de" | "it" | "pt" | "ru" | "ja" | "ko" | "zh" | "ar" | "hi",
//             value: translationData.value,
//             status: translationData.status as "draft" | "active" | "archived",
//             version: translationData.version,
//           });
//         }
//       }
//     });

//     // Export data
//     const exportedKeys = await db
//       .select({
//         key: l10nKey,
//         translation: translation,
//       })
//       .from(l10nKey)
//       .leftJoin(translation, eq(l10nKey.id, translation.keyId))
//       .where(eq(l10nKey.serviceId, testServiceId));

//     const keyMap = new Map<string, any>();
//     for (const row of exportedKeys) {
//       if (!keyMap.has(row.key.id)) {
//         keyMap.set(row.key.id, {
//           id: row.key.id,
//           keyName: row.key.keyName,
//           namespaceId: row.key.namespaceId,
//           tags: row.key.tags,
//           status: row.key.status,
//           translations: [],
//         });
//       }
//       if (row.translation) {
//         keyMap.get(row.key.id)!.translations.push({
//           locale: row.translation.locale,
//           value: row.translation.value || "",
//           status: row.translation.status,
//           version: row.translation.version,
//         });
//       }
//     }

//     const exportData: ExportData = {
//       service: testServiceCode,
//       locales: [],
//       exportedAt: new Date().toISOString(),
//       data: {
//         keys: Array.from(keyMap.values()),
//       },
//     };

//     // Validate round-trip compatibility
//     const importPayload: ImportPayload = {
//       dryRun: false,
//       service: testServiceCode,
//       data: {
//         keys: exportData.data.keys.map(key => ({
//           ...key,
//           status: key.status as "draft" | "active" | "archived",
//           translations: key.translations.map(t => ({
//             ...t,
//             locale: t.locale as "en" | "es" | "fr" | "de" | "it" | "pt" | "ru" | "ja" | "ko" | "zh" | "ar" | "hi",
//             status: t.status as "draft" | "active" | "archived",
//           })),
//         })),
//       },
//     };

//     const validationResult = importPayloadSchema.safeParse(importPayload);
//     expect(validationResult.success).toBe(true);

//     // Verify basic data integrity
//     expect(exportData.data.keys).toHaveLength(1);
//     expect(exportData.data.keys[0].translations).toHaveLength(2);
//   });

//   // Integration tests for successful import scenarios (Task 2 requirement)
//   it("should successfully import new keys", async () => {
//     const uniqueId = `success-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

//     await db.transaction(async (tx) => {
//       await tx.insert(l10nKey).values({
//         id: uniqueId,
//         serviceId: testServiceId,
//         keyName: "success.test",
//         namespaceId: testNamespaceId,
//         tags: ["test"],
//         status: "active",
//       });

//       await tx.insert(translation).values({
//         id: crypto.randomUUID(),
//         keyId: uniqueId,
//         locale: "en",
//         value: "Success",
//         status: "active",
//         version: 1,
//       });
//     });

//     const importedKey = await db
//       .select()
//       .from(l10nKey)
//       .where(eq(l10nKey.id, uniqueId))
//       .limit(1)
//       .then(results => results[0]);

//     const importedTranslations = await db
//       .select()
//       .from(translation)
//       .where(eq(translation.keyId, uniqueId));

//     expect(importedKey).toBeDefined();
//     expect(importedKey!.keyName).toBe("success.test");
//     expect(importedTranslations).toHaveLength(1);
//   });

//   // Integration tests for transaction rollback scenarios (Task 2 requirement)
//   it("should rollback transaction on constraint violation", async () => {
//     const uniqueId = `rollback-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

//     // Create existing key
//     await db.insert(l10nKey).values({
//       id: uniqueId,
//       serviceId: testServiceId,
//       keyName: "rollback.test",
//       namespaceId: testNamespaceId,
//       tags: [],
//       status: "draft",
//     });

//     const beforeKeys = await db
//       .select()
//       .from(l10nKey)
//       .where(eq(l10nKey.serviceId, testServiceId));
//     const beforeCount = beforeKeys.length;

//     // Attempt duplicate insertion - should fail
//     try {
//       await db.transaction(async (tx) => {
//         await tx.insert(l10nKey).values({
//           id: `${uniqueId}-valid`,
//           serviceId: testServiceId,
//           keyName: "rollback.valid",
//           namespaceId: testNamespaceId,
//           tags: [],
//           status: "draft",
//         });

//         await tx.insert(l10nKey).values({
//           id: uniqueId, // Duplicate - should trigger rollback
//           serviceId: testServiceId,
//           keyName: "rollback.duplicate",
//           namespaceId: testNamespaceId,
//           tags: [],
//           status: "draft",
//         });
//       });
//     } catch (error) {
//       expect(error).toBeDefined();
//     }

//     const afterKeys = await db
//       .select()
//       .from(l10nKey)
//       .where(eq(l10nKey.serviceId, testServiceId));
//     const afterCount = afterKeys.length;

//     // Should be same count (rollback occurred)
//     expect(afterCount).toBe(beforeCount);
//   });
// });
