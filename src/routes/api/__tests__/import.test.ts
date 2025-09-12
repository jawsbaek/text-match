import { describe, expect, it } from "vitest";
import { importPayloadSchema } from "~/lib/api/import-export-types";

describe("Import API Schema Validation", () => {
  describe("importPayloadSchema", () => {
    it("should validate valid import payload", () => {
      const validPayload = {
        dryRun: false,
        service: "web-app",
        data: {
          keys: [
            {
              id: "key-1",
              keyName: "auth.login.title",
              namespaceId: "auth-ns",
              tags: ["auth", "ui"],
              status: "draft" as const,
              translations: [
                {
                  locale: "en" as const,
                  value: "Login",
                  status: "draft" as const,
                  version: 1,
                },
                {
                  locale: "es" as const,
                  value: "Iniciar sesión",
                  status: "active" as const,
                  version: 2,
                },
              ],
            },
          ],
        },
      };

      const result = importPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.service).toBe("web-app");
        expect(result.data.data.keys).toHaveLength(1);
        expect(result.data.data.keys[0].translations).toHaveLength(2);
      }
    });

    it("should apply default values correctly", () => {
      const minimalPayload = {
        service: "web-app",
        data: {
          keys: [
            {
              id: "key-1",
              keyName: "simple.key",
              translations: [
                {
                  locale: "en" as const,
                  value: "Simple Value",
                },
              ],
            },
          ],
        },
      };

      const result = importPayloadSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(false); // default
        expect(result.data.data.keys[0].tags).toEqual([]); // default
        expect(result.data.data.keys[0].status).toBe("draft"); // default
        expect(result.data.data.keys[0].translations[0].status).toBe("draft"); // default
        expect(result.data.data.keys[0].translations[0].version).toBe(1); // default
      }
    });

    it("should reject empty service code", () => {
      const invalidPayload = {
        service: "",
        data: {
          keys: [],
        },
      };

      const result = importPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.path.includes("service") && issue.code === "too_small",
          ),
        ).toBe(true);
      }
    });

    it("should reject invalid key data", () => {
      const invalidPayload = {
        service: "web-app",
        data: {
          keys: [
            {
              id: "", // empty id
              keyName: "", // empty key name
              translations: [
                {
                  locale: "invalid-locale", // invalid locale
                  value: "Test",
                },
              ],
            },
          ],
        },
      };

      const result = importPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(
          issues.some((issue) => issue.path.includes("id") && issue.code === "too_small"),
        ).toBe(true);
        expect(
          issues.some(
            (issue) => issue.path.includes("keyName") && issue.code === "too_small",
          ),
        ).toBe(true);
        expect(issues.some((issue) => issue.path.includes("locale"))).toBe(true);
      }
    });

    it("should reject invalid status values", () => {
      const invalidPayload = {
        service: "web-app",
        data: {
          keys: [
            {
              id: "key-1",
              keyName: "test.key",
              status: "invalid-status",
              translations: [
                {
                  locale: "en" as const,
                  value: "Test",
                  status: "invalid-status",
                },
              ],
            },
          ],
        },
      };

      const result = importPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        // Check for any status-related validation error
        expect(issues.some((issue) => issue.path.some((p) => p === "status"))).toBe(true);
      }
    });

    it("should validate translation version constraints", () => {
      const invalidPayload = {
        service: "web-app",
        data: {
          keys: [
            {
              id: "key-1",
              keyName: "test.key",
              translations: [
                {
                  locale: "en" as const,
                  value: "Test",
                  version: 0, // invalid - must be positive
                },
                {
                  locale: "es" as const,
                  value: "Prueba",
                  version: -1, // invalid - must be positive
                },
              ],
            },
          ],
        },
      };

      const result = importPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(
          issues.some(
            (issue) => issue.path.includes("version") && issue.code === "too_small",
          ),
        ).toBe(true);
      }
    });

    it("should accept keys without translations", () => {
      const validPayload = {
        service: "web-app",
        data: {
          keys: [
            {
              id: "key-1",
              keyName: "placeholder.key",
              // No translations array - should default to empty
            },
          ],
        },
      };

      const result = importPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.keys[0].translations).toEqual([]);
      }
    });

    it("should validate all supported locales", () => {
      const supportedLocales = [
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

      for (const locale of supportedLocales) {
        const payload = {
          service: "web-app",
          data: {
            keys: [
              {
                id: "key-1",
                keyName: "test.key",
                translations: [
                  {
                    locale: locale as any,
                    value: "Test value",
                  },
                ],
              },
            ],
          },
        };

        const result = importPayloadSchema.safeParse(payload);
        expect(result.success).toBe(true);
      }
    });

    it("should handle complex nested structure", () => {
      const complexPayload = {
        dryRun: true,
        service: "complex-app",
        data: {
          keys: [
            {
              id: "nav.menu.item-1",
              keyName: "navigation.menu.home",
              namespaceId: "navigation",
              tags: ["nav", "menu", "primary"],
              status: "active" as const,
              translations: [
                {
                  locale: "en" as const,
                  value: "Home",
                  status: "active" as const,
                  version: 3,
                },
                {
                  locale: "fr" as const,
                  value: "Accueil",
                  status: "active" as const,
                  version: 2,
                },
                {
                  locale: "de" as const,
                  value: "Startseite",
                  status: "draft" as const,
                  version: 1,
                },
              ],
            },
            {
              id: "nav.menu.item-2",
              keyName: "navigation.menu.about",
              namespaceId: "navigation",
              tags: ["nav", "menu"],
              status: "draft" as const,
              translations: [
                {
                  locale: "en" as const,
                  value: "About Us",
                  status: "draft" as const,
                  version: 1,
                },
              ],
            },
          ],
        },
      };

      const result = importPayloadSchema.safeParse(complexPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(true);
        expect(result.data.data.keys).toHaveLength(2);
        expect(result.data.data.keys[0].translations).toHaveLength(3);
        expect(result.data.data.keys[1].translations).toHaveLength(1);
      }
    });
  });
});
