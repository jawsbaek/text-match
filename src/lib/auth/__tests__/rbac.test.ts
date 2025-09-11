import { describe, expect, it } from "vitest";
import type { IdentityUser } from "~/lib/auth/identity";
import {
  canEdit,
  canReview,
  canView,
  createForbiddenResponse,
  hasAllRoles,
  hasAnyRole,
  hasRole,
  isAdmin,
  isOwner,
} from "~/lib/auth/rbac";

describe("RBAC Helper Functions", () => {
  const adminUser: IdentityUser = {
    sub: "user1",
    email: "admin@test.com",
    roles: ["Admin"],
  };

  const editorUser: IdentityUser = {
    sub: "user2",
    email: "editor@test.com",
    roles: ["Editor", "Viewer"],
  };

  const viewerUser: IdentityUser = {
    sub: "user3",
    email: "viewer@test.com",
    roles: ["Viewer"],
  };

  const noRolesUser: IdentityUser = {
    sub: "user4",
    email: "noroles@test.com",
    roles: undefined,
  };

  describe("hasRole", () => {
    it("should return true when user has the role", () => {
      expect(hasRole(adminUser, "Admin")).toBe(true);
      expect(hasRole(editorUser, "Editor")).toBe(true);
    });

    it("should return false when user doesn't have the role", () => {
      expect(hasRole(viewerUser, "Admin")).toBe(false);
      expect(hasRole(editorUser, "Admin")).toBe(false);
    });

    it("should return false for user with no roles", () => {
      expect(hasRole(noRolesUser, "Admin")).toBe(false);
    });

    it("should return false for undefined user", () => {
      expect(hasRole(undefined, "Admin")).toBe(false);
    });
  });

  describe("hasAnyRole", () => {
    it("should return true when user has any of the roles", () => {
      expect(hasAnyRole(editorUser, ["Admin", "Editor"])).toBe(true);
      expect(hasAnyRole(viewerUser, ["Viewer", "Admin"])).toBe(true);
    });

    it("should return false when user has none of the roles", () => {
      expect(hasAnyRole(viewerUser, ["Admin", "Editor"])).toBe(false);
    });

    it("should return false for user with no roles", () => {
      expect(hasAnyRole(noRolesUser, ["Admin", "Editor"])).toBe(false);
    });
  });

  describe("hasAllRoles", () => {
    it("should return true when user has all roles", () => {
      expect(hasAllRoles(editorUser, ["Editor", "Viewer"])).toBe(true);
    });

    it("should return false when user is missing some roles", () => {
      expect(hasAllRoles(editorUser, ["Editor", "Admin"])).toBe(false);
    });

    it("should return false for user with no roles", () => {
      expect(hasAllRoles(noRolesUser, ["Viewer"])).toBe(false);
    });
  });

  describe("Role-specific helpers", () => {
    it("should identify admin users", () => {
      expect(isAdmin(adminUser)).toBe(true);
      expect(isAdmin(editorUser)).toBe(false);
    });

    it("should identify owner users", () => {
      const ownerUser: IdentityUser = { ...adminUser, roles: ["Owner"] };
      expect(isOwner(ownerUser)).toBe(true);
      expect(isOwner(adminUser)).toBe(false);
    });

    it("should identify users who can edit", () => {
      expect(canEdit(adminUser)).toBe(true);
      expect(canEdit(editorUser)).toBe(true);
      expect(canEdit(viewerUser)).toBe(false);
    });

    it("should identify users who can review", () => {
      expect(canReview(adminUser)).toBe(true);
      expect(canReview(editorUser)).toBe(true);
      expect(canReview(viewerUser)).toBe(false);

      const reviewerUser: IdentityUser = { ...viewerUser, roles: ["Reviewer"] };
      expect(canReview(reviewerUser)).toBe(true);
    });

    it("should identify users who can view", () => {
      expect(canView(adminUser)).toBe(true);
      expect(canView(editorUser)).toBe(true);
      expect(canView(viewerUser)).toBe(true);
      expect(canView(noRolesUser)).toBe(false);
    });
  });

  describe("createForbiddenResponse", () => {
    it("should create a 403 response with default message", async () => {
      const response = createForbiddenResponse();
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error).toBe("Insufficient permissions");
    });

    it("should create a 403 response with custom message", async () => {
      const response = createForbiddenResponse("Custom error message");
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error).toBe("Custom error message");
    });
  });
});
