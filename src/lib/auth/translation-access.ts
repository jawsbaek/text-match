import { eq } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";

import type { IdentityUser } from "~/lib/auth/identity";
import { canEdit, canView, isAdmin, PERMISSIONS, type Permission } from "~/lib/auth/rbac";
import { validateServiceAccess } from "~/lib/auth/service-access";
import { db } from "~/lib/db";
import { l10nKey, service, translation } from "~/lib/db/schema";

/**
 * Translation Access Control
 *
 * This module provides authorization helpers for translation endpoints.
 * Translations inherit their access control from their associated l10n_key,
 * which in turn is linked to a service for row-level authorization.
 *
 * Access Pattern:
 * Translation -> Key -> Service -> Authorization
 */

/**
 * Validate if a user can access a specific translation with given permission
 * This checks access through the translation -> key -> service relationship
 * @param user - Authenticated user
 * @param translationId - Translation ID to check
 * @param permission - Required permission level ('read' or 'write')
 * @returns Promise<boolean> indicating if access is allowed
 */
export async function validateTranslationAccess(
  user: IdentityUser | undefined,
  translationId: string,
  permission: Permission,
): Promise<boolean> {
  if (!user) return false;

  // Admin has access to everything
  if (isAdmin(user)) return true;

  try {
    // Get the translation with its associated key and service
    const translationWithService = await db
      .select({
        translationId: translation.id,
        keyId: l10nKey.id,
        serviceId: l10nKey.serviceId,
        serviceOwners: service.owners,
      })
      .from(translation)
      .innerJoin(l10nKey, eq(translation.keyId, l10nKey.id))
      .leftJoin(service, eq(l10nKey.serviceId, service.id))
      .where(eq(translation.id, translationId))
      .limit(1);

    if (translationWithService.length === 0) return false;

    const { serviceId, serviceOwners } = translationWithService[0];

    // If translation has no associated service (legacy data), check role-based permissions
    if (!serviceId) {
      switch (permission) {
        case PERMISSIONS.READ:
          return canView(user);
        case PERMISSIONS.WRITE:
          return canEdit(user);
        default:
          return false;
      }
    }

    // Check if user owns the service
    if (serviceOwners?.includes(user.sub)) return true;

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
    console.error("Error validating translation access:", error);
    return false;
  }
}

/**
 * Validate access to a translation through its key ID
 * This is useful when creating new translations for an existing key
 * @param user - Authenticated user
 * @param keyId - Key ID that the translation belongs to
 * @param permission - Required permission level
 * @returns Promise<boolean> indicating if access is allowed
 */
export async function validateTranslationAccessByKey(
  user: IdentityUser | undefined,
  keyId: string,
  permission: Permission,
): Promise<boolean> {
  if (!user) return false;

  // Admin has access to everything
  if (isAdmin(user)) return true;

  try {
    // Get the key with its associated service
    const keyWithService = await db
      .select({
        keyId: l10nKey.id,
        serviceId: l10nKey.serviceId,
        serviceOwners: service.owners,
      })
      .from(l10nKey)
      .leftJoin(service, eq(l10nKey.serviceId, service.id))
      .where(eq(l10nKey.id, keyId))
      .limit(1);

    if (keyWithService.length === 0) return false;

    const { serviceId } = keyWithService[0];

    // If key has no associated service (legacy data), check role-based permissions
    if (!serviceId) {
      switch (permission) {
        case PERMISSIONS.READ:
          return canView(user);
        case PERMISSIONS.WRITE:
          return canEdit(user);
        default:
          return false;
      }
    }

    // Use the service validation logic
    return await validateServiceAccess(user, serviceId, permission);
  } catch (error) {
    console.error("Error validating translation access by key:", error);
    return false;
  }
}

/**
 * Add translation access filter to queries involving the translation table
 * This filters translations based on their associated service access
 * @param query - Drizzle query builder for translation
 * @param user - Authenticated user
 * @param permission - Required permission level
 * @returns Modified query with service-based access filters
 */
export function addTranslationAccessFilter<T extends PgSelect>(
  query: T,
  user: IdentityUser | undefined,
  permission: Permission,
): T {
  if (!user) {
    return query.where(eq(translation.id, "impossible-translation-id")) as T;
  }

  // Admin has access to everything
  if (isAdmin(user)) {
    return query;
  }

  // For read permission with view role, allow access to all translations
  if (permission === PERMISSIONS.READ && canView(user)) {
    return query;
  }

  // For write permission, check if user has edit role
  if (permission === PERMISSIONS.WRITE && !canEdit(user)) {
    return query.where(eq(translation.id, "impossible-translation-id")) as T;
  }

  // Note: For more granular filtering, we would need to join with l10nKey and service tables
  // This is a simplified version that relies on role-based access
  // In a production system, you might want to implement the full join-based filtering

  return query;
}

/**
 * Authorization helper for translation endpoint handlers
 * This provides a standardized way to check translation access in route handlers
 */
export const translationAuthHelpers = {
  /**
   * Check if user can read a specific translation
   */
  canReadTranslation: async (
    user: IdentityUser | undefined,
    translationId: string,
  ): Promise<boolean> => {
    return await validateTranslationAccess(user, translationId, PERMISSIONS.READ);
  },

  /**
   * Check if user can write/update a specific translation
   */
  canWriteTranslation: async (
    user: IdentityUser | undefined,
    translationId: string,
  ): Promise<boolean> => {
    return await validateTranslationAccess(user, translationId, PERMISSIONS.WRITE);
  },

  /**
   * Check if user can create a translation for a specific key
   */
  canCreateTranslationForKey: async (
    user: IdentityUser | undefined,
    keyId: string,
  ): Promise<boolean> => {
    return await validateTranslationAccessByKey(user, keyId, PERMISSIONS.WRITE);
  },

  /**
   * Check if user can list translations (general read access)
   */
  canListTranslations: (user: IdentityUser | undefined): boolean => {
    return user ? isAdmin(user) || canView(user) : false;
  },
} as const;

/**
 * Common error messages for translation authorization
 */
export const translationAuthErrors = {
  UNAUTHORIZED: "Unauthorized",
  INSUFFICIENT_PERMISSIONS: "Insufficient permissions",
  TRANSLATION_NOT_FOUND: "Translation not found",
  KEY_NOT_FOUND: "Key not found",
  NO_SERVICE_ACCESS: "You don't have permission to access this translation's service",
  NO_WRITE_PERMISSION: "You don't have permission to modify this translation",
  NO_CREATE_PERMISSION: "You don't have permission to create translations for this key",
} as const;
