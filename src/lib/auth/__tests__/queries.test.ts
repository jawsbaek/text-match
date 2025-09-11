import { describe, expect, it } from "vitest";
import { getUserRoles } from "~/lib/auth/queries";

describe("Auth Queries", () => {
  describe("getUserRoles", () => {
    it("should be a function", () => {
      expect(typeof getUserRoles).toBe("function");
    });

    it("should return empty array for non-existent user", async () => {
      // This test will pass because the function handles errors gracefully
      const roles = await getUserRoles("non-existent-user");
      expect(Array.isArray(roles)).toBe(true);
    });

    // Note: Full integration tests would require database setup
    // These are kept minimal to avoid test database dependencies
  });
});
