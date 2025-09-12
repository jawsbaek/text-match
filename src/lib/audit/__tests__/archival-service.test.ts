import { beforeEach, describe, expect, it } from "vitest";
import { db } from "~/lib/db";
import { event } from "~/lib/db/schema";
import { EventArchivalService } from "../archival-service";
import { logEvent } from "../event-logger";

describe("Event Archival Service", () => {
  let archivalService: EventArchivalService;

  beforeEach(async () => {
    // Clean up event table before each test
    await db.delete(event);
    archivalService = new EventArchivalService();
  });

  describe("getArchivalStatus", () => {
    it("should return archival status for empty database", async () => {
      const status = await archivalService.getArchivalStatus();

      expect(status.hotStorageEvents).toBe(0);
      expect(status.warmStorageEvents).toBe(0);
      expect(status.coldStorageEvents).toBe(0);
      expect(status.oldestEventAge).toBe(0);
      expect(status.storageBreakdown.hot.sizeGB).toBe(0);
    });

    it("should calculate storage metrics correctly", async () => {
      // Create some test events
      for (let i = 0; i < 5; i++) {
        await logEvent({
          actor: `user-${i}`,
          action: "create",
          entityType: "l10n_key",
          entityId: `key-${i}`,
          after: { id: `key-${i}`, name: `test-key-${i}` },
        });
      }

      const status = await archivalService.getArchivalStatus();

      expect(status.hotStorageEvents).toBe(5);
      expect(status.warmStorageEvents).toBe(0);
      expect(status.coldStorageEvents).toBe(0);
      expect(status.storageBreakdown.hot.events).toBe(5);
      expect(status.storageBreakdown.hot.sizeGB).toBeGreaterThan(0);
    });

    it("should detect oldest event age", async () => {
      // Create an event (will have current timestamp)
      await logEvent({
        actor: "test-user",
        action: "create",
        entityType: "l10n_key",
        entityId: "test-key",
        after: { id: "test-key" },
      });

      const status = await archivalService.getArchivalStatus();

      expect(status.oldestEventAge).toBe(0); // Should be 0 days old (current)
    });
  });

  describe("archiveToWarmStorage", () => {
    it("should handle empty database gracefully", async () => {
      const result = await archivalService.archiveToWarmStorage(30);

      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(0);
      expect(result.archiveId).toBe("");
    });

    it("should identify events for archival", async () => {
      // Create test events
      for (let i = 0; i < 3; i++) {
        await logEvent({
          actor: `user-${i}`,
          action: "create",
          entityType: "l10n_key",
          entityId: `key-${i}`,
          after: { id: `key-${i}` },
        });
      }

      // For this test, use 0 days to archive all events
      const result = await archivalService.archiveToWarmStorage(0);

      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(3);
      expect(result.archiveId).toBeTruthy();
    });

    it("should process events in batches", async () => {
      // Create more events than batch size would suggest
      for (let i = 0; i < 15; i++) {
        await logEvent({
          actor: `user-${i}`,
          action: "create",
          entityType: "l10n_key",
          entityId: `key-${i}`,
          after: { id: `key-${i}` },
        });
      }

      const result = await archivalService.archiveToWarmStorage(0);

      expect(result.success).toBe(true);
      expect(result.archivedCount).toBeGreaterThan(0);
      expect(result.archivedCount).toBeLessThanOrEqual(15);
    });
  });

  describe("archiveToColdStorage", () => {
    it("should handle cold storage archival", async () => {
      const result = await archivalService.archiveToColdStorage(730);

      expect(result.success).toBe(true);
      expect(result.archiveId).toMatch(/cold_archive_\d+/);
    });
  });

  describe("verifyArchive", () => {
    it("should verify archive integrity", async () => {
      const archiveId = "test-archive-123";
      const result = await archivalService.verifyArchive(archiveId);

      expect(result).toBe(true);
    });
  });

  describe("cleanupArchivedEvents", () => {
    it("should handle cleanup gracefully", async () => {
      const result = await archivalService.cleanupArchivedEvents("test-archive", 90);

      expect(result).toBe(0); // No events cleaned in MVP
    });
  });

  describe("storage size estimation", () => {
    it("should estimate storage size correctly", async () => {
      // Test the private method indirectly through getArchivalStatus
      for (let i = 0; i < 1000; i++) {
        await logEvent({
          actor: "test-user",
          action: "create",
          entityType: "l10n_key",
          entityId: `key-${i}`,
          after: { id: `key-${i}`, largeData: "x".repeat(100) },
        });
      }

      const status = await archivalService.getArchivalStatus();

      // With 1000 events, should be around 2MB (0.002GB)
      expect(status.storageBreakdown.hot.sizeGB).toBeGreaterThan(0.001);
      expect(status.storageBreakdown.hot.sizeGB).toBeLessThan(0.1);
    });
  });
});
