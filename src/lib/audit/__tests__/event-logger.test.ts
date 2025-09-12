import { beforeEach, describe, expect, it } from "vitest";
import { db } from "~/lib/db";
import { event } from "~/lib/db/schema";
import { logEvent, type EventLogData } from "../event-logger";

interface TestKeyData {
  id: string;
  keyName: string;
  serviceId?: string;
  tags?: string[];
  status: string;
}

interface TestTranslationData {
  id: string;
  value: string;
  version: number;
  status: string;
}

describe("Event Logger", () => {
  beforeEach(async () => {
    // Clean up event table before each test
    await db.delete(event);
  });

  describe("logEvent", () => {
    it("should log a create event with after data", async () => {
      const eventData: EventLogData = {
        actor: "test-user-123",
        action: "create",
        entityType: "l10n_key",
        entityId: "test-key-456",
        after: {
          id: "test-key-456",
          keyName: "test.key",
          serviceId: "service-123",
          tags: ["test"],
          status: "draft",
        },
      };

      await logEvent(eventData);

      // Verify event was logged
      const events = await db.select().from(event);
      expect(events).toHaveLength(1);

      const loggedEvent = events[0];
      expect(loggedEvent.actor).toBe("test-user-123");
      expect(loggedEvent.action).toBe("create");
      expect(loggedEvent.entityType).toBe("l10n_key");
      expect(loggedEvent.entityId).toBe("test-key-456");
      expect(loggedEvent.before).toBeNull();
      expect(loggedEvent.after).toBeDefined();

      // Parse and verify after data
      const afterData = loggedEvent.after as TestKeyData;
      expect(afterData.id).toBe("test-key-456");
      expect(afterData.keyName).toBe("test.key");
      expect(afterData.status).toBe("draft");
    });

    it("should log an update event with before and after data", async () => {
      const eventData: EventLogData = {
        actor: "test-user-456",
        action: "update",
        entityType: "translation",
        entityId: "translation-789",
        before: {
          id: "translation-789",
          value: "old value",
          version: 1,
          status: "draft",
        },
        after: {
          id: "translation-789",
          value: "new value",
          version: 2,
          status: "active",
        },
      };

      await logEvent(eventData);

      // Verify event was logged
      const events = await db.select().from(event);
      expect(events).toHaveLength(1);

      const loggedEvent = events[0];
      expect(loggedEvent.actor).toBe("test-user-456");
      expect(loggedEvent.action).toBe("update");
      expect(loggedEvent.entityType).toBe("translation");
      expect(loggedEvent.entityId).toBe("translation-789");

      // Parse and verify before data
      const beforeData = loggedEvent.before as TestTranslationData;
      expect(beforeData.value).toBe("old value");
      expect(beforeData.version).toBe(1);

      // Parse and verify after data
      const afterData = loggedEvent.after as TestTranslationData;
      expect(afterData.value).toBe("new value");
      expect(afterData.version).toBe(2);
    });

    it("should log a delete event with before data only", async () => {
      const eventData: EventLogData = {
        actor: "test-user-789",
        action: "delete",
        entityType: "l10n_key",
        entityId: "deleted-key-123",
        before: {
          id: "deleted-key-123",
          keyName: "deleted.key",
          status: "archived",
        },
      };

      await logEvent(eventData);

      // Verify event was logged
      const events = await db.select().from(event);
      expect(events).toHaveLength(1);

      const loggedEvent = events[0];
      expect(loggedEvent.actor).toBe("test-user-789");
      expect(loggedEvent.action).toBe("delete");
      expect(loggedEvent.entityType).toBe("l10n_key");
      expect(loggedEvent.entityId).toBe("deleted-key-123");
      expect(loggedEvent.after).toBeNull();

      // Parse and verify before data
      const beforeData = loggedEvent.before as TestKeyData;
      expect(beforeData.keyName).toBe("deleted.key");
      expect(beforeData.status).toBe("archived");
    });

    it("should generate unique IDs for events", async () => {
      const eventData1: EventLogData = {
        actor: "user-1",
        action: "create",
        entityType: "l10n_key",
        entityId: "key-1",
      };

      const eventData2: EventLogData = {
        actor: "user-2",
        action: "create",
        entityType: "l10n_key",
        entityId: "key-2",
      };

      await logEvent(eventData1);
      await logEvent(eventData2);

      const events = await db.select().from(event);
      expect(events).toHaveLength(2);
      expect(events[0].id).not.toBe(events[1].id);
    });

    it("should set created timestamp", async () => {
      const beforeTime = new Date();

      const eventData: EventLogData = {
        actor: "test-user",
        action: "create",
        entityType: "l10n_key",
        entityId: "test-key",
      };

      await logEvent(eventData);

      const afterTime = new Date();

      const events = await db.select().from(event);
      expect(events).toHaveLength(1);

      const loggedEvent = events[0];
      const eventTime = new Date(loggedEvent.createdAt);

      expect(eventTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(eventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });
});
