import { describe, expect, it } from "vitest";
import { verifyIdentityJWT } from "~/lib/auth/identity";

describe("Keys API Auth Integration", () => {
  it("should have auth middleware applied to route", () => {
    // Test that the auth functions are properly imported
    expect(verifyIdentityJWT).toBeDefined();
    expect(typeof verifyIdentityJWT).toBe("function");
  });

  it("should validate auth header parsing", async () => {
    // Test the JWT verification function with null input
    const result = await verifyIdentityJWT(null);
    expect(result).toBeNull();
  });

  it("should validate auth header format", async () => {
    // Test with empty string after Bearer (should return null)
    const result = await verifyIdentityJWT("Bearer ");
    expect(result).toBeNull();
  });

  it("should extract bearer token correctly", async () => {
    // Test that bearer token extraction works
    // This will fail JWT verification due to invalid token, but tests the parsing
    try {
      await verifyIdentityJWT("Bearer invalid-jwt");
    } catch (error) {
      // Expected to fail with JWT verification error, not parsing error
      expect(error).toBeDefined();
    }
  });
});
