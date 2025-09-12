import { eq, gte } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "~/lib/db";
import { event, l10nKey, translation } from "~/lib/db/schema";
import { logEvent } from "../event-logger";

describe("Events API Integration", () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(event);
    await db.delete(translation);
    await db.delete(l10nKey);
  });

  describe("Event creation during CRUD operations", () => {
    it("should create event when key is created", async () => {
      const keyId = "test-key-123";
      const keyData = {
        id: keyId,
        keyName: "test.key",
        serviceId: null,
        namespaceId: null,
        tags: ["test"],
        status: "draft" as const,
      };

      // Insert key
      await db.insert(l10nKey).values(keyData);

      // Log event
      await logEvent({
        actor: "test-user",
        action: "create",
        entityType: "l10n_key",
        entityId: keyId,
        after: keyData,
      });

      // Verify event was created
      const events = await db.select().from(event);
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe("create");
      expect(events[0].entityType).toBe("l10n_key");
      expect(events[0].entityId).toBe(keyId);
    });

    it("should create event when translation is updated", async () => {
      // First create a key
      const keyId = "test-key-456";
      await db.insert(l10nKey).values({
        id: keyId,
        keyName: "test.translation.key",
        serviceId: null,
        namespaceId: null,
        tags: [],
        status: "draft",
      });

      // Create a translation
      const translationId = "test-translation-789";
      const originalData = {
        id: translationId,
        keyId,
        locale: "en" as const,
        value: "Original value",
        status: "draft" as const,
        version: 1,
        checksum: null,
      };

      await db.insert(translation).values(originalData);

      // Update translation
      const updatedData = {
        ...originalData,
        value: "Updated value",
        version: 2,
      };

      await db
        .update(translation)
        .set({ value: "Updated value", version: 2 })
        .where(eq(translation.id, translationId));

      // Log update event
      await logEvent({
        actor: "test-user",
        action: "update",
        entityType: "translation",
        entityId: translationId,
        before: originalData,
        after: updatedData,
      });

      // Verify event was created
      const events = await db.select().from(event);
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe("update");
      expect(events[0].entityType).toBe("translation");
      expect(events[0].entityId).toBe(translationId);
      expect(events[0].before).toBeDefined();
      expect(events[0].after).toBeDefined();
    });
  });

  describe("Event querying performance", () => {
    it("should efficiently query events with entity filtering", async () => {
      // Create multiple events for different entities
      const events = [];
      for (let i = 0; i < 10; i++) {
        events.push({
          actor: `user-${i}`,
          action: "create" as const,
          entityType: i % 2 === 0 ? ("l10n_key" as const) : ("translation" as const),
          entityId: `entity-${i}`,
          after: { id: `entity-${i}`, name: `entity-${i}` },
        });
      }

      // Log all events
      for (const eventData of events) {
        await logEvent(eventData);
      }

      const startTime = Date.now();

      // Query events filtered by entity type
      const keyEvents = await db
        .select()
        .from(event)
        .where(eq(event.entityType, "l10n_key"))
        .limit(50);

      const queryTime = Date.now() - startTime;

      // Performance assertion - should be much faster than 300ms for small dataset
      expect(queryTime).toBeLessThan(100);
      expect(keyEvents).toHaveLength(5); // Half of the 10 events are l10n_key type
    });

    it("should efficiently query events with pagination", async () => {
      // Create 25 events
      for (let i = 0; i < 25; i++) {
        await logEvent({
          actor: "test-user",
          action: "create",
          entityType: "l10n_key",
          entityId: `key-${i}`,
          after: { id: `key-${i}` },
        });
      }

      const startTime = Date.now();

      // Query with pagination
      const firstPage = await db.select().from(event).limit(10).offset(0);

      const secondPage = await db.select().from(event).limit(10).offset(10);

      const queryTime = Date.now() - startTime;

      // Performance assertion
      expect(queryTime).toBeLessThan(100);
      expect(firstPage).toHaveLength(10);
      expect(secondPage).toHaveLength(10);

      // Verify no overlap
      const firstPageIds = firstPage.map((e) => e.id);
      const secondPageIds = secondPage.map((e) => e.id);
      const intersection = firstPageIds.filter((id) => secondPageIds.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it("should efficiently query events with date range filtering", async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Create events at different times (simulated by manual insertion)
      await db.insert(event).values({
        id: "event-old",
        actor: "user-1",
        action: "create",
        entityType: "l10n_key",
        entityId: "key-old",
        before: null,
        after: null,
        createdAt: twoHoursAgo,
      });

      await db.insert(event).values({
        id: "event-recent",
        actor: "user-2",
        action: "create",
        entityType: "l10n_key",
        entityId: "key-recent",
        before: null,
        after: null,
        createdAt: now,
      });

      const startTime = Date.now();

      // Query events from the last hour
      const recentEvents = await db
        .select()
        .from(event)
        .where(gte(event.createdAt, oneHourAgo));

      const queryTime = Date.now() - startTime;

      // Performance assertion
      expect(queryTime).toBeLessThan(100);
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].id).toBe("event-recent");
    });
  });
});
