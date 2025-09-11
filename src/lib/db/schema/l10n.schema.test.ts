import { describe, expect, it } from "vitest";
import {
  event,
  l10nKey,
  localeEnum,
  namespace,
  releaseBundle,
  service,
  statusEnum,
  translation,
} from "./l10n.schema";

describe("L10n Schema Constraints", () => {
  describe("Service Schema", () => {
    it("should have correct schema structure", () => {
      expect(service.id).toBeDefined();
      expect(service.code).toBeDefined();
      expect(service.name).toBeDefined();
      expect(service.owners).toBeDefined();
      expect(service.createdAt).toBeDefined();
      expect(service.updatedAt).toBeDefined();
    });

    it("should have default values", () => {
      expect(service.owners.default).toEqual(["admin@local"]);
    });
  });

  describe("Status Enum", () => {
    it("should contain correct status values", () => {
      const statusValues = statusEnum.enumValues;
      expect(statusValues).toContain("draft");
      expect(statusValues).toContain("active");
      expect(statusValues).toContain("archived");
      expect(statusValues).toHaveLength(3);
    });
  });

  describe("Locale Enum", () => {
    it("should contain common locale codes", () => {
      const localeValues = localeEnum.enumValues;
      expect(localeValues).toContain("en");
      expect(localeValues).toContain("es");
      expect(localeValues).toContain("fr");
      expect(localeValues).toContain("de");
      expect(localeValues).toContain("ja");
      expect(localeValues).toContain("ko");
      expect(localeValues).toContain("zh");
    });
  });

  describe("Translation Schema", () => {
    it("should have correct schema structure", () => {
      expect(translation.id).toBeDefined();
      expect(translation.keyId).toBeDefined();
      expect(translation.locale).toBeDefined();
      expect(translation.value).toBeDefined();
      expect(translation.status).toBeDefined();
      expect(translation.version).toBeDefined();
    });

    it("should use status enum with default", () => {
      expect(translation.status.default).toBe("draft");
    });

    it("should have version with default", () => {
      expect(translation.version.default).toBe(1);
    });
  });

  describe("L10n Key Schema", () => {
    it("should have correct schema structure", () => {
      expect(l10nKey.id).toBeDefined();
      expect(l10nKey.serviceId).toBeDefined();
      expect(l10nKey.namespaceId).toBeDefined();
      expect(l10nKey.keyName).toBeDefined();
      expect(l10nKey.tags).toBeDefined();
      expect(l10nKey.status).toBeDefined();
    });

    it("should have default empty tags array", () => {
      expect(l10nKey.tags.default).toEqual([]);
    });

    it("should use status enum with default", () => {
      expect(l10nKey.status.default).toBe("draft");
    });
  });

  describe("Namespace Schema", () => {
    it("should have correct schema structure", () => {
      expect(namespace.id).toBeDefined();
      expect(namespace.serviceId).toBeDefined();
      expect(namespace.name).toBeDefined();
      expect(namespace.createdAt).toBeDefined();
      expect(namespace.updatedAt).toBeDefined();
    });
  });

  describe("Event Schema", () => {
    it("should have correct schema structure", () => {
      expect(event.id).toBeDefined();
      expect(event.actor).toBeDefined();
      expect(event.action).toBeDefined();
      expect(event.entityType).toBeDefined();
      expect(event.entityId).toBeDefined();
      expect(event.before).toBeDefined();
      expect(event.after).toBeDefined();
    });
  });

  describe("Release Bundle Schema", () => {
    it("should have correct schema structure", () => {
      expect(releaseBundle.id).toBeDefined();
      expect(releaseBundle.serviceId).toBeDefined();
      expect(releaseBundle.locales).toBeDefined();
      expect(releaseBundle.snapshotRef).toBeDefined();
    });

    it("should have default empty locales array", () => {
      expect(releaseBundle.locales.default).toEqual([]);
    });
  });
});

// Integration tests that would require a real database
describe("Schema Integration Tests", () => {
  it.skip("should enforce unique service code constraint", async () => {
    // This would require a real database connection
    // await expect(async () => {
    //   await testDb.insert(service).values([
    //     { id: "1", code: "test", name: "Test 1", owners: ["admin"] },
    //     { id: "2", code: "test", name: "Test 2", owners: ["admin"] }
    //   ]);
    // }).rejects.toThrow();
  });

  it.skip("should enforce foreign key constraints", async () => {
    // This would require a real database connection
    // Test that inserting translation with invalid key_id fails
  });

  it.skip("should enforce enum constraints", async () => {
    // This would require a real database connection
    // Test that inserting invalid status or locale values fails
  });
});
