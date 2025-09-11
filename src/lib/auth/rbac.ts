import type { IdentityUser } from "~/lib/auth/identity";

/**
 * Role-Based Access Control (RBAC) Helper Functions
 *
 * These functions provide convenient ways to check user permissions based on their roles.
 * All functions handle undefined users gracefully by returning false.
 *
 * Available roles (from Story 1.1 bootstrap data):
 * - Admin: Full system access
 * - Owner: Project ownership level access
 * - Editor: Can edit translations and content
 * - Reviewer: Can review and approve content
 * - Viewer: Read-only access
 *
 * @example
 * ```typescript
 * // In a route handler
 * const user = context.user; // From auth middleware
 *
 * if (!canEdit(user)) {
 *   return createForbiddenResponse("You need Editor role or higher");
 * }
 *
 * // Role-specific checks
 * if (isAdmin(user)) {
 *   // Admin-only functionality
 * } else if (canReview(user)) {
 *   // Reviewer+ functionality
 * } else if (canView(user)) {
 *   // Basic read access
 * }
 * ```
 */

/**
 * Check if user has a specific role
 * @param user - The authenticated user (can be undefined)
 * @param role - The role name to check for
 * @returns true if user has the role, false otherwise
 */
export function hasRole(user: IdentityUser | undefined, role: string): boolean {
  if (!user?.roles) return false;
  return user.roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: IdentityUser | undefined, roles: string[]): boolean {
  if (!user?.roles) return false;
  return roles.some((role) => user.roles!.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(user: IdentityUser | undefined, roles: string[]): boolean {
  if (!user?.roles) return false;
  return roles.every((role) => user.roles!.includes(role));
}

/**
 * Check if user is an admin (has Admin role)
 */
export function isAdmin(user: IdentityUser | undefined): boolean {
  return hasRole(user, "Admin");
}

/**
 * Check if user is an owner (has Owner role)
 */
export function isOwner(user: IdentityUser | undefined): boolean {
  return hasRole(user, "Owner");
}

/**
 * Check if user can edit (has Admin, Owner, or Editor role)
 */
export function canEdit(user: IdentityUser | undefined): boolean {
  return hasAnyRole(user, ["Admin", "Owner", "Editor"]);
}

/**
 * Check if user can review (has Admin, Owner, Editor, or Reviewer role)
 */
export function canReview(user: IdentityUser | undefined): boolean {
  return hasAnyRole(user, ["Admin", "Owner", "Editor", "Reviewer"]);
}

/**
 * Check if user can view (has any role)
 */
export function canView(user: IdentityUser | undefined): boolean {
  return hasAnyRole(user, ["Admin", "Owner", "Editor", "Reviewer", "Viewer"]);
}

/**
 * Create a 403 Forbidden response for insufficient permissions
 */
export function createForbiddenResponse(message = "Insufficient permissions"): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
