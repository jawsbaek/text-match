import { createServerFileRoute } from "@tanstack/react-start/server";
import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { DEFAULT_REDACTION_CONFIG, redactSensitiveData } from "~/lib/audit/pii-redaction";
import { auth } from "~/lib/auth/auth";
import { verifyIdentityJWT, type IdentityUser } from "~/lib/auth/identity";
import { db } from "~/lib/db";
import { event } from "~/lib/db/schema";

// Default time window for audit queries (30 days)
const DEFAULT_QUERY_WINDOW_DAYS = 30;
const MAX_QUERY_WINDOW_DAYS = 90;

// Zod schema for events query parameters with time-based constraints
export const eventsQuerySchema = z
  .object({
    entity: z.enum(["key", "translation"]).optional(),
    entityId: z.string().optional(),
    actor: z.string().optional(),
    action: z.enum(["create", "update", "delete"]).optional(),
    startDate: z.string().datetime({ message: "Invalid datetime format" }).optional(),
    endDate: z.string().datetime({ message: "Invalid datetime format" }).optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    const now = new Date();

    // Apply default time window if no dates specified
    if (!data.startDate && !data.endDate) {
      // This will be handled in the route logic
      return;
    }

    // Validate time window constraints
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);

      // Ensure start date is before end date
      if (start >= end) {
        ctx.addIssue({
          code: "custom",
          message: "startDate must be before endDate",
          path: ["startDate"],
        });
      }

      // Enforce maximum query window
      const diffMs = end.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays > MAX_QUERY_WINDOW_DAYS) {
        ctx.addIssue({
          code: "custom",
          message: `Query window cannot exceed ${MAX_QUERY_WINDOW_DAYS} days`,
          path: ["endDate"],
        });
      }
    }

    // Prevent queries too far in the past without explicit date range
    if (data.startDate && !data.endDate) {
      const start = new Date(data.startDate);
      const maxPastDate = new Date(
        now.getTime() - MAX_QUERY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );

      if (start < maxPastDate) {
        ctx.addIssue({
          code: "custom",
          message: `startDate cannot be more than ${MAX_QUERY_WINDOW_DAYS} days ago without specifying endDate`,
          path: ["startDate"],
        });
      }
    }
  });

export type EventsQuery = z.infer<typeof eventsQuerySchema>;

/**
 * Get authenticated user from request headers
 */
async function getAuthenticatedUser(request: Request): Promise<IdentityUser | null> {
  const headers = request.headers;
  const bearer = headers.get("authorization");
  const identityUser = await verifyIdentityJWT(bearer);

  if (identityUser) {
    return identityUser;
  }

  // Try better-auth session as fallback
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });

  if (session?.user) {
    // Convert better-auth user to IdentityUser format
    return {
      sub: session.user.id,
      email: session.user.email,
      roles: ["Viewer"], // Default role for better-auth users
    };
  }

  return null;
}

/**
 * Performance monitoring utility
 */
function logQueryPerformance(
  queryType: string,
  durationMs: number,
  params: Record<string, unknown>,
) {
  // In production, this would integrate with monitoring systems like DataDog, New Relic, etc.
  console.log(`[AUDIT_QUERY_PERFORMANCE] ${queryType}: ${durationMs}ms`, {
    duration: durationMs,
    params,
    timestamp: new Date().toISOString(),
  });

  // Alert if query exceeds P95 threshold
  if (durationMs > 300) {
    console.warn(`[AUDIT_QUERY_SLOW] Query exceeded 300ms threshold: ${durationMs}ms`, {
      queryType,
      params,
    });
  }
}

// Create server route for events API
export const ServerRoute = createServerFileRoute("/api/events").methods({
  GET: async ({ request }: { request: Request }) => {
    const queryStartTime = Date.now();

    // Get authenticated user
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const parsed = eventsQuerySchema.safeParse(queryParams);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: z.treeifyError(parsed.error) }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const { entity, entityId, actor, action, limit, offset } = parsed.data;
    let { startDate, endDate } = parsed.data;

    // Apply default time window if no dates specified
    if (!startDate && !endDate) {
      const now = new Date();
      endDate = now.toISOString();
      startDate = new Date(
        now.getTime() - DEFAULT_QUERY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
    }

    const conds: SQL<unknown>[] = [];

    // Entity filtering
    if (entity) {
      conds.push(eq(event.entityType, entity));
    }

    // Entity ID filtering
    if (entityId) {
      conds.push(eq(event.entityId, entityId));
    }

    // Actor filtering
    if (actor) {
      conds.push(eq(event.actor, actor));
    }

    // Action filtering
    if (action) {
      conds.push(eq(event.action, action));
    }

    // Date range filtering
    if (startDate) {
      conds.push(gte(event.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conds.push(lte(event.createdAt, new Date(endDate)));
    }

    // Execute query
    const baseQuery = db
      .select()
      .from(event)
      .orderBy(sql`${event.createdAt} DESC`);

    const finalQuery = conds.length > 0 ? baseQuery.where(and(...conds)) : baseQuery;
    const rows = await finalQuery.limit(limit).offset(offset);

    // Count query for pagination
    const countBaseQuery = db.select({ count: sql<number>`count(*)` }).from(event);

    const countFinalQuery =
      conds.length > 0 ? countBaseQuery.where(and(...conds)) : countBaseQuery;
    const [{ count }] = await countFinalQuery;

    // Apply enhanced sensitive data redaction
    const redactedRows = rows.map((row) =>
      redactSensitiveData(row as Record<string, unknown>, DEFAULT_REDACTION_CONFIG),
    );

    // Log performance metrics
    const queryDuration = Date.now() - queryStartTime;
    logQueryPerformance("events_query", queryDuration, {
      entity,
      entityId,
      actor,
      action,
      hasDateFilter: !!(startDate || endDate),
      limit,
      offset,
      resultCount: rows.length,
      totalCount: count,
    });

    return new Response(
      JSON.stringify({
        items: redactedRows,
        pagination: {
          limit,
          offset,
          count,
        },
        queryInfo: {
          duration: queryDuration,
          appliedDateRange: {
            startDate,
            endDate,
          },
        },
      }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  },
});
