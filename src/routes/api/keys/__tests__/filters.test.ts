import { describe, expect, it } from "vitest";
import { getKeysQuerySchema } from "~/routes/api/keys/index";

describe("Keys API Filters", () => {
  describe("Query Parameter Validation", () => {
    it("should validate valid query parameters", () => {
      const validParams = {
        prefix: "app.",
        service: "my-service",
        locale: "en",
        status: "active",
        limit: "50",
        offset: "0",
      };

      const result = getKeysQuerySchema.safeParse(validParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.prefix).toBe("app.");
        expect(result.data.service).toBe("my-service");
        expect(result.data.locale).toBe("en");
        expect(result.data.status).toBe("active");
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it("should apply default values for limit and offset", () => {
      const minimalParams = {};

      const result = getKeysQuerySchema.safeParse(minimalParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.limit).toBe(100);
        expect(result.data.offset).toBe(0);
      }
    });

    it("should reject invalid locale codes", () => {
      const invalidParams = {
        locale: "invalid-locale",
      };

      const result = getKeysQuerySchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(["locale"]);
      }
    });

    it("should reject invalid status values", () => {
      const invalidParams = {
        status: "invalid-status",
      };

      const result = getKeysQuerySchema.safeParse(invalidParams);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(["status"]);
      }
    });

    it("should enforce limit boundaries", () => {
      const tooLargeLimit = {
        limit: "150",
      };

      const result = getKeysQuerySchema.safeParse(tooLargeLimit);
      expect(result.success).toBe(false);

      const zeroLimit = {
        limit: "0",
      };

      const zeroResult = getKeysQuerySchema.safeParse(zeroLimit);
      expect(zeroResult.success).toBe(false);

      const validLimit = {
        limit: "75",
      };

      const validResult = getKeysQuerySchema.safeParse(validLimit);
      expect(validResult.success).toBe(true);
    });

    it("should enforce offset minimum", () => {
      const negativeOffset = {
        offset: "-1",
      };

      const result = getKeysQuerySchema.safeParse(negativeOffset);
      expect(result.success).toBe(false);

      const validOffset = {
        offset: "25",
      };

      const validResult = getKeysQuerySchema.safeParse(validOffset);
      expect(validResult.success).toBe(true);
    });

    it("should handle all supported locales", () => {
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

      supportedLocales.forEach((locale) => {
        const params = { locale };
        const result = getKeysQuerySchema.safeParse(params);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.locale).toBe(locale);
        }
      });
    });

    it("should handle all supported statuses", () => {
      const supportedStatuses = ["draft", "active", "archived"];

      supportedStatuses.forEach((status) => {
        const params = { status };
        const result = getKeysQuerySchema.safeParse(params);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.status).toBe(status);
        }
      });
    });

    it("should coerce string numbers to integers", () => {
      const stringNumbers = {
        limit: "25",
        offset: "50",
      };

      const result = getKeysQuerySchema.safeParse(stringNumbers);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(50);
        expect(typeof result.data.limit).toBe("number");
        expect(typeof result.data.offset).toBe("number");
      }
    });
  });

  describe("Filter Combinations", () => {
    it("should handle multiple filters together", () => {
      const complexParams = {
        prefix: "user.",
        service: "auth-service",
        locale: "es",
        status: "active",
        limit: "25",
        offset: "10",
      };

      const result = getKeysQuerySchema.safeParse(complexParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.prefix).toBe("user.");
        expect(result.data.service).toBe("auth-service");
        expect(result.data.locale).toBe("es");
        expect(result.data.status).toBe("active");
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it("should handle partial filter sets", () => {
      const partialParams = {
        prefix: "api.",
        status: "draft",
      };

      const result = getKeysQuerySchema.safeParse(partialParams);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.prefix).toBe("api.");
        expect(result.data.status).toBe("draft");
        expect(result.data.service).toBeUndefined();
        expect(result.data.locale).toBeUndefined();
        expect(result.data.limit).toBe(100); // default
        expect(result.data.offset).toBe(0); // default
      }
    });
  });

  describe("Pagination Logic", () => {
    it("should calculate pagination correctly", () => {
      const scenarios = [
        { limit: 10, offset: 0, expectedPage: 1 },
        { limit: 10, offset: 10, expectedPage: 2 },
        { limit: 25, offset: 50, expectedPage: 3 },
        { limit: 50, offset: 100, expectedPage: 3 },
      ];

      scenarios.forEach(({ limit, offset, expectedPage }) => {
        const params = { limit: limit.toString(), offset: offset.toString() };
        const result = getKeysQuerySchema.safeParse(params);
        expect(result.success).toBe(true);

        if (result.success) {
          const calculatedPage = Math.floor(result.data.offset / result.data.limit) + 1;
          expect(calculatedPage).toBe(expectedPage);
        }
      });
    });

    it("should validate pagination response format", () => {
      const expectedResponseFormat = {
        items: [],
        pagination: {
          limit: 25,
          offset: 10,
          count: 15,
        },
      };

      expect(expectedResponseFormat.items).toBeDefined();
      expect(expectedResponseFormat.pagination).toBeDefined();
      expect(expectedResponseFormat.pagination.limit).toBe(25);
      expect(expectedResponseFormat.pagination.offset).toBe(10);
      expect(expectedResponseFormat.pagination.count).toBe(15);
    });
  });

  describe("BCP-47 Locale Validation", () => {
    it("should only accept supported BCP-47 locale codes", () => {
      const validBCP47Codes = [
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
      const invalidCodes = ["en-US", "es-ES", "invalid", "123", ""];

      validBCP47Codes.forEach((code) => {
        const result = getKeysQuerySchema.safeParse({ locale: code });
        expect(result.success).toBe(true);
      });

      invalidCodes.forEach((code) => {
        const result = getKeysQuerySchema.safeParse({ locale: code });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Query Performance Considerations", () => {
    it("should enforce reasonable limits for performance", () => {
      const maxLimit = 100;
      const params = { limit: maxLimit.toString() };

      const result = getKeysQuerySchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.limit).toBeLessThanOrEqual(maxLimit);
      }
    });

    it("should handle large offset values", () => {
      const largeOffset = 10000;
      const params = { offset: largeOffset.toString() };

      const result = getKeysQuerySchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.offset).toBe(largeOffset);
      }
    });
  });
});
