import { queryOptions } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { db } from "~/lib/db";
import { permission, role } from "~/lib/db/schema";

/**
 * Type for auth query result
 */
export type AuthQueryResult = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  emailVerified: boolean;
} | null;

/**
 * TanStack Query options for fetching current user session
 */
export function authQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "session"],
    queryFn: async (): Promise<AuthQueryResult> => {
      // This is a client-side query, so we need to make a fetch request
      // Since this is used in React components, it should call the auth API
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data?.user ?? null;
      } catch (error) {
        console.error("Failed to fetch session:", error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get user roles from the database for session-based authentication
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  try {
    const userPermissions = await db
      .select({
        roleName: role.name,
      })
      .from(permission)
      .innerJoin(role, eq(permission.roleId, role.id))
      .where(eq(permission.userId, userId));

    return userPermissions.map((p) => p.roleName);
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    return [];
  }
}
