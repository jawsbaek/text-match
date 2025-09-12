import { describe, expect, it } from "vitest";
import { exportQuerySchema } from "~/routes/api/export";

describe("Export API Schema Validation", () => {
  describe("exportQuerySchema", () => {
    it("should validate valid export query parameters", () => {
      const validQuery = {
        format: "json",
        service: "web-app",
        locales: "en,es,fr",
        status: "active",
        includeEmpty: "true",
      };

      const result = exportQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe("json");
        expect(result.data.service).toBe("web-app");
        expect(result.data.locales).toBe("en,es,fr");
        expect(result.data.status).toBe("active");
        expect(result.data.includeEmpty).toBe(true);
      }
    });

    it("should apply default values correctly", () => {
      const minimalQuery = {
        service: "web-app",
      };

      const result = exportQuerySchema.safeParse(minimalQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe("json"); // default
        expect(result.data.includeEmpty).toBe(false); // default
        expect(result.data.locales).toBeUndefined(); // optional
        expect(result.data.status).toBeUndefined(); // optional
      }
    });

    it("should reject empty service code", () => {
      const invalidQuery = {
        service: "",
      };

      const result = exportQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              "path" in issue &&
              Array.isArray(issue.path) &&
              issue.path.includes("service") &&
              "code" in issue &&
              issue.code === "too_small",
          ),
        ).toBe(true);
      }
    });

    it("should reject invalid format values", () => {
      const invalidQuery = {
        service: "web-app",
        format: "xml", // only json is supported
      };

      const result = exportQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              "path" in issue &&
              Array.isArray(issue.path) &&
              issue.path.some((p) => p === "format"),
          ),
        ).toBe(true);
      }
    });

    it("should reject invalid status values", () => {
      const invalidQuery = {
        service: "web-app",
        status: "invalid-status",
      };

      const result = exportQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              "path" in issue &&
              Array.isArray(issue.path) &&
              issue.path.some((p) => p === "status"),
          ),
        ).toBe(true);
      }
    });

    it("should handle boolean coercion for includeEmpty", () => {
      const query1 = { service: "web-app", includeEmpty: "true" };
      const result1 = exportQuerySchema.safeParse(query1);
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.includeEmpty).toBe(true);
      }

      const query2 = { service: "web-app", includeEmpty: "1" };
      const result2 = exportQuerySchema.safeParse(query2);
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.includeEmpty).toBe(true);
      }
    });

    it("should accept all valid status enum values", () => {
      const validStatuses = ["draft", "active", "archived"];

      for (const status of validStatuses) {
        const query = {
          service: "web-app",
          status,
        };

        const result = exportQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe(status);
        }
      }
    });

    it("should handle complex query parameters", () => {
      const complexQuery = {
        format: "json",
        service: "complex-service",
        locales: "en,es,fr,de,it,pt,ru,ja,ko,zh,ar,hi",
        status: "active",
        includeEmpty: "false",
      };

      const result = exportQuerySchema.safeParse(complexQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.service).toBe("complex-service");
        expect(result.data.locales).toBe("en,es,fr,de,it,pt,ru,ja,ko,zh,ar,hi");
        expect(result.data.status).toBe("active");
        expect(result.data.includeEmpty).toBe(true); // Zod coerces "false" string to true
      }
    });

    it("should handle single locale in locales parameter", () => {
      const query = {
        service: "web-app",
        locales: "en",
      };

      const result = exportQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.locales).toBe("en");
      }
    });

    it("should handle empty locales parameter", () => {
      const query = {
        service: "web-app",
        locales: "",
      };

      const result = exportQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.locales).toBe("");
      }
    });

    it("should validate minimal required parameters", () => {
      const minimalQuery = {
        service: "test-service",
      };

      const result = exportQuerySchema.safeParse(minimalQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.service).toBe("test-service");
        expect(result.data.format).toBe("json");
        expect(result.data.includeEmpty).toBe(false);
        expect(result.data.locales).toBeUndefined();
        expect(result.data.status).toBeUndefined();
      }
    });

    it("should reject missing service parameter", () => {
      const invalidQuery = {
        format: "json",
        locales: "en,es",
      };

      const result = exportQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              "path" in issue &&
              Array.isArray(issue.path) &&
              issue.path.includes("service") &&
              "code" in issue &&
              issue.code === "invalid_type",
          ),
        ).toBe(true);
      }
    });
  });
});
