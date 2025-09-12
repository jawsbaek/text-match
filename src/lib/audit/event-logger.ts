import { db } from "~/lib/db";
import { event } from "~/lib/db/schema";

export interface EventLogData {
  actor: string;
  action: "create" | "update" | "delete" | "import" | "export";
  entityType: "l10n_key" | "translation" | "service";
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * Log an audit event to the database
 * @param eventData - The event data to log
 * @param tx - Optional database transaction to use
 */
export async function logEvent(eventData: EventLogData, tx = db) {
  await tx.insert(event).values({
    id: crypto.randomUUID(),
    actor: eventData.actor,
    action: eventData.action,
    entityType: eventData.entityType,
    entityId: eventData.entityId,
    before: eventData.before ? eventData.before : null,
    after: eventData.after ? eventData.after : null,
    createdAt: new Date(),
  });
}
