import { eq, inArray, or, sql } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";

import type { IdentityUser } from "~/lib/auth/identity";
import { canEdit, canView, isAdmin, PERMISSIONS, type Permission } from "~/lib/auth/rbac";
import { db } from "~/lib/db";
import { l10nKey, service } from "~/lib/db/schema";

/**
 * Service Access Query Filtering
 *
 * This module provides query filtering helpers for implementing row-level
 * authorization based on service ownership and user roles.
 *
 * The filtering strategy:
 * - Admin: Access to all services
 * - Service Owners: Full access to owned services
 * - Role-based: Access based on role permissions (Editor/Reviewer/Viewer)
 */

/**
 * Add service access filter to a query that involves the service table
 * @param query - Drizzle query builder
 * @param user - Authenticated user
 * @param permission - Required permission level ('read' or 'write')
 * @returns Modified query with access filters applied
 */
export function addServiceAccessFilter<T extends PgSelect>(
  query: T,
  user: IdentityUser | undefined,
  permission: Permission,
): T {
  if (!user) {
    // No user - deny all access by adding impossible condition
    return query.where(eq(service.id, "impossible-service-id")) as T;
  }

  // Admin has access to everything - no filter needed
  if (isAdmin(user)) {
    return query;
  }

  const conditions = [];

  // Add ownership condition - user is in the service owners array
  // Note: Using a custom SQL condition for array containment
  conditions.push(sql`${user.sub} = ANY(${service.owners})`);

  // Add role-based conditions based on permission level
  if (permission === PERMISSIONS.READ && canView(user)) {
    // For read permission, viewers can access all services
    // This condition is always true, so we don't add additional restrictions
    return query;
  } else if (permission === PERMISSIONS.WRITE && canEdit(user)) {
    // For write permission, editors can only write to services they own
    // The ownership condition above handles this
  } else {
    // User doesn't have required role - deny access
    return query.where(eq(service.id, "impossible-service-id")) as T;
  }

  // Apply ownership filter for write operations or non-admin users
  return query.where(or(...conditions)) as T;
}

/**
 * Add service access filter for queries involving l10n_key table
 * This filters keys based on their associated service access
 * @param query - Drizzle query builder for l10n_key
 * @param user - Authenticated user
 * @param permission - Required permission level ('read' or 'write')
 * @returns Modified query with service-based access filters
 */
export function addKeyServiceAccessFilter<T extends PgSelect>(
  query: T,
  user: IdentityUser | undefined,
  permission: Permission,
): T {
  if (!user) {
    return query.where(eq(l10nKey.id, "impossible-key-id")) as T;
  }

  // Admin has access to everything
  if (isAdmin(user)) {
    return query;
  }

  // For read permission with view role, allow access to all keys
  if (permission === PERMISSIONS.READ && canView(user)) {
    return query;
  }

  // For write permission or ownership-based access, filter by service ownership
  // This requires a subquery to check service ownership
  const accessibleServiceIds = db
    .select({ id: service.id })
    .from(service)
    .where(sql`${user.sub} = ANY(${service.owners})`);

  if (permission === PERMISSIONS.WRITE && !canEdit(user)) {
    // User doesn't have write role - deny access
    return query.where(eq(l10nKey.id, "impossible-key-id")) as T;
  }

  // Filter keys to only those from accessible services
  return query.where(
    or(
      inArray(l10nKey.serviceId, accessibleServiceIds),
      // Also allow keys without service association (legacy data)
      sql`${l10nKey.serviceId} IS NULL`,
    ),
  ) as T;
}

/**
 * Validate if a user can access a specific service with given permission
 * This is a direct validation without query filtering
 * @param user - Authenticated user
 * @param serviceId - Service ID to check
 * @param permission - Required permission level
 * @returns Promise<boolean> indicating if access is allowed
 */
export async function validateServiceAccess(
  user: IdentityUser | undefined,
  serviceId: string,
  permission: Permission,
): Promise<boolean> {
  if (!user) return false;

  // Admin has access to everything
  if (isAdmin(user)) return true;

  try {
    // Check if service exists and get ownership info
    const serviceRecord = await db
      .select({ owners: service.owners })
      .from(service)
      .where(eq(service.id, serviceId))
      .limit(1);

    if (serviceRecord.length === 0) return false;

    // Check if user owns the service
    if (serviceRecord[0].owners.includes(user.sub)) return true;

    // For non-owners, check role-based permissions
    switch (permission) {
      case PERMISSIONS.READ:
        return canView(user);
      case PERMISSIONS.WRITE:
        return canEdit(user);
      default:
        return false;
    }
  } catch (error) {
    console.error("Error validating service access:", error);
    return false;
  }
}

/**
 * Get the list of service IDs that a user can access with given permission
 * This is useful for UI filtering and bulk operations
 * @param user - Authenticated user
 * @param permission - Required permission level
 * @returns Promise<string[]> of accessible service IDs
 */
export async function getAccessibleServiceIds(
  user: IdentityUser | undefined,
  permission: Permission,
): Promise<string[]> {
  if (!user) return [];

  // Admin has access to all services
  if (isAdmin(user)) {
    const allServices = await db.select({ id: service.id }).from(service);
    return allServices.map((s) => s.id);
  }

  // For read permission with view role, return all services
  if (permission === PERMISSIONS.READ && canView(user)) {
    const allServices = await db.select({ id: service.id }).from(service);
    return allServices.map((s) => s.id);
  }

  // For write permission or ownership-based access, return owned services
  try {
    const ownedServices = await db
      .select({ id: service.id })
      .from(service)
      .where(sql`${user.sub} = ANY(${service.owners})`);

    return ownedServices.map((s) => s.id);
  } catch (error) {
    console.error("Error getting accessible service IDs:", error);
    return [];
  }
}
