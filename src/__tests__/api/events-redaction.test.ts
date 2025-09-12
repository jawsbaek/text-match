// @ts-nocheck - Temporarily disable TypeScript for redaction tests
import { beforeEach, describe, expect, it } from "vitest";
import { redactSensitiveData } from "~/lib/audit/pii-redaction";
import { db } from "~/lib/db";
import { event } from "~/lib/db/schema";

describe("Events API Redaction", () => {
  beforeEach(async () => {
    // Clean up event table before each test
    await db.delete(event);
  });

  describe("redactSensitiveData with enhanced PII detection", () => {
    it("should redact long translation values in before data", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "translation",
        entityId: "trans-456",
        before: {
          id: "trans-456",
          value:
            "This is a very long translation value that exceeds 100 characters and should be redacted from the audit log because it contains sensitive info",
          status: "draft",
          version: 1,
        },
        after: {
          id: "trans-456",
          value: "Updated short value",
          status: "active",
          version: 2,
        },
        createdAt: new Date(),
      };

      const redacted = redactSensitiveData(eventRecord);

      expect((redacted.before as any).value).toBe(
        "[REDACTED: 142 characters - exceeds 100 chars]",
      );
      expect((redacted.before as any).status).toBe("draft");
      expect((redacted.after as any).value).toBe("Updated short value");
    });

    it("should redact long translation values in after data", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "translation",
        entityId: "trans-456",
        before: {
          id: "trans-456",
          value: "Short value",
          status: "draft",
          version: 1,
        },
        after: {
          id: "trans-456",
          value:
            "This is an extremely long translation value that definitely exceeds the 100 character limit and contains potentially sensitive customer data that should be protected from appearing in audit logs",
          status: "active",
          version: 2,
        },
        createdAt: new Date(),
      };

      const redacted = redactSensitiveData(eventRecord);

      expect((redacted.before as any).value).toBe("Short value");
      expect((redacted.after as any).value).toBe("[REDACTED: 194 characters - exceeds 100 chars]");
      expect((redacted.after as any).status).toBe("active");
    });

    it("should not redact short translation values", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "translation",
        entityId: "trans-456",
        before: {
          id: "trans-456",
          value: "Short before",
          status: "draft",
          version: 1,
        },
        after: {
          id: "trans-456",
          value: "Short after",
          status: "active",
          version: 2,
        },
        createdAt: new Date(),
      };

      const redacted = redactSensitiveData(eventRecord);

      expect((redacted.before as any).value).toBe("Short before");
      expect((redacted.after as any).value).toBe("Short after");
    });

    it("should handle events without before/after data", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "delete",
        entityType: "l10n_key",
        entityId: "key-456",
        before: null,
        after: null,
        createdAt: new Date(),
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.before).toBeNull();
      expect(redacted.after).toBeNull();
      expect(redacted.actor).toBe("user@test.com");
    });

    it("should handle events with string JSON data", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "translation",
        entityId: "trans-456",
        before: JSON.stringify({
          id: "trans-456",
          value:
            "This is a very long string that should definitely be redacted because it exceeds our 100 character limit for sensitive data protection",
          status: "draft",
        }),
        after: JSON.stringify({
          id: "trans-456",
          value: "Short updated value",
          status: "active",
        }),
        createdAt: new Date(),
      };

      const redacted = redactSensitiveData(eventRecord);

      expect((redacted.before as any).value).toBe(
        "[REDACTED: 134 characters - exceeds 100 chars]",
      );
      expect((redacted.before as any).status).toBe("draft");
      expect((redacted.after as any).value).toBe("Short updated value");
      expect((redacted.after as any).status).toBe("active");
    });

    it("should handle events with non-string values", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "l10n_key",
        entityId: "key-456",
        before: {
          id: "key-456",
          tags: ["tag1", "tag2"],
          count: 42,
          active: true,
        },
        after: {
          id: "key-456",
          tags: ["tag1", "tag2", "tag3"],
          count: 43,
          active: false,
        },
        createdAt: new Date(),
      };

      const redacted = redactSensitiveData(eventRecord);

      // Non-string values should not be affected
      expect((redacted.before as any).tags).toEqual(["tag1", "tag2"]);
      expect((redacted.before as any).count).toBe(42);
      expect((redacted.after as any).active).toBe(false);
    });

    it("should detect and redact email addresses in translation values", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "translation",
        entityId: "trans-456",
        before: {
          value: "Contact support@company.com for assistance",
          status: "draft",
        },
        after: {
          value: "Email admin@example.org for help",
          status: "active",
        },
        createdAt: new Date(),
      };

      const redacted = redactSensitiveData(eventRecord);

      expect((redacted.before as any).value).toBe("Contact [EMAIL_REDACTED] for assistance");
      expect((redacted.after as any).value).toBe("Email [EMAIL_REDACTED] for help");
      expect((redacted.before as any).status).toBe("draft");
      expect((redacted.after as any).status).toBe("active");
    });

    it("should redact sensitive field names like passwords", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "key",
        entityId: "key-456",
        before: {
          keyName: "user.settings",
          password: "oldpassword123",
          apiKey: "api_live_1234567890abcdef1234567890abcdef",
        },
        after: {
          keyName: "user.settings",
          password: "newpassword456",
          apiKey: "api_prod_9876543210fedcba9876543210fedcba",
        },
        createdAt: new Date(),
      };

      const redacted = redactSensitiveData(eventRecord);

      expect((redacted.before as any).keyName).toBe("[REDACTED: sensitive field name]"); // keyName contains "key"
      expect((redacted.before as any).password).toBe("[REDACTED: sensitive field name]");
      expect((redacted.before as any).apiKey).toBe("[REDACTED: sensitive field name]");
      expect((redacted.after as any).keyName).toBe("[REDACTED: sensitive field name]");
      expect((redacted.after as any).password).toBe("[REDACTED: sensitive field name]");
      expect((redacted.after as any).apiKey).toBe("[REDACTED: sensitive field name]");
    });
  });
});
