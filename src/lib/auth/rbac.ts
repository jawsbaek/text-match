import { eq, sql } from "drizzle-orm";

import type { IdentityUser } from "~/lib/auth/identity";
import { db } from "~/lib/db";
import { service } from "~/lib/db/schema";

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

// Permission constants for service-level access
export const PERMISSIONS = {
  READ: "read",
  WRITE: "write",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Check if user can access a specific service with the given permission
 * @param user - The authenticated user
 * @param serviceId - The service ID to check access for
 * @param permission - The permission level required ('read' or 'write')
 * @returns true if user has access, false otherwise
 */
export async function canAccessService(
  user: IdentityUser | undefined,
  serviceId: string,
  permission: Permission,
): Promise<boolean> {
  if (!user) return false;

  // Admin has access to everything
  if (isAdmin(user)) return true;

  // Check if user is owner of the service
  if (await isServiceOwner(user, serviceId)) return true;

  // For non-owners, check role-based permissions
  switch (permission) {
    case PERMISSIONS.READ:
      return canView(user);
    case PERMISSIONS.WRITE:
      return canEdit(user);
    default:
      return false;
  }
}

/**
 * Get all services that a user can access with the given permission
 * @param user - The authenticated user
 * @param permission - The permission level required ('read' or 'write')
 * @returns Array of service IDs the user can access
 */
export async function getAccessibleServices(
  user: IdentityUser | undefined,
  permission: Permission,
): Promise<string[]> {
  if (!user) return [];

  // Admin has access to all services
  if (isAdmin(user)) {
    const allServices = await db.select({ id: service.id }).from(service);
    return allServices.map((s) => s.id);
  }

  // Get services owned by the user
  const ownedServices = await db
    .select({ id: service.id })
    .from(service)
    .where(sql`${user.sub} = ANY(${service.owners})`);

  const ownedServiceIds = ownedServices.map((s) => s.id);

  // For read permission, if user has view role, they can access all services
  if (permission === PERMISSIONS.READ && canView(user)) {
    const allServices = await db.select({ id: service.id }).from(service);
    return allServices.map((s) => s.id);
  }

  // For write permission, check if user has edit role
  if (permission === PERMISSIONS.WRITE && canEdit(user)) {
    // For now, editors can only write to services they own
    // This can be extended later to support team assignments
    return ownedServiceIds;
  }

  // Default to owned services only
  return ownedServiceIds;
}

/**
 * Check if user is an owner of a specific service
 * @param user - The authenticated user
 * @param serviceId - The service ID to check ownership for
 * @returns true if user owns the service, false otherwise
 */
export async function isServiceOwner(
  user: IdentityUser | undefined,
  serviceId: string,
): Promise<boolean> {
  if (!user) return false;

  try {
    const serviceRecord = await db
      .select({ owners: service.owners })
      .from(service)
      .where(eq(service.id, serviceId))
      .limit(1);

    if (serviceRecord.length === 0) return false;

    return serviceRecord[0].owners.includes(user.sub);
  } catch (error) {
    console.error("Error checking service ownership:", error);
    return false;
  }
}
