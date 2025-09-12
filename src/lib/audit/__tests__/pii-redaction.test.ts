import { describe, expect, it } from "vitest";
import {
  createRedactionConfig,
  DEFAULT_REDACTION_CONFIG,
  redactSensitiveData,
  validateRedaction,
} from "../pii-redaction";

describe("Enhanced PII Redaction", () => {
  describe("redactSensitiveData", () => {
    it("should redact email addresses in translation values", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "translation",
        entityId: "trans-456",
        before: {
          value: "Contact us at support@company.com for help",
          status: "draft",
        },
        after: {
          value: "Reach out to admin@company.com for assistance",
          status: "active",
        },
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.before.value).toBe("Contact us at [EMAIL_REDACTED] for help");
      expect(redacted.after.value).toBe("Reach out to [EMAIL_REDACTED] for assistance");
      expect(redacted.before.status).toBe("draft");
      expect(redacted.after.status).toBe("active");
    });

    it("should redact phone numbers in translation values", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "create",
        entityType: "translation",
        entityId: "trans-789",
        after: {
          value: "Call us at (555) 123-4567 or +1-800-555-0199",
          locale: "en",
        },
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.after.value).toBe(
        "Call us at [PHONE_REDACTED] or [PHONE_REDACTED]",
      );
      expect(redacted.after.locale).toBe("en");
    });

    it("should redact API keys and tokens", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "key",
        entityId: "key-456",
        before: {
          config: {
            apiKey: "sk_live_1234567890abcdef1234567890abcdef",
            shortKey: "abc123",
          },
        },
        after: {
          config: {
            apiKey: "sk_prod_9876543210fedcba9876543210fedcba",
            shortKey: "xyz789",
          },
        },
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.before.config.apiKey).toBe("[REDACTED: sensitive field name]");
      expect(redacted.after.config.apiKey).toBe("[REDACTED: sensitive field name]");
      expect(redacted.before.config.shortKey).toBe("[REDACTED: sensitive field name]"); // "shortKey" contains "key"
      expect(redacted.after.config.shortKey).toBe("[REDACTED: sensitive field name]");
    });

    it("should redact credit card numbers", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "create",
        entityType: "translation",
        entityId: "trans-999",
        after: {
          value: "Payment: 4532 1234 5678 9012 or 5555-4444-3333-2222",
        },
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.after.value).toBe(
        "Payment: [CREDITCARD_REDACTED] or [CREDITCARD_REDACTED]",
      );
    });

    it("should redact sensitive field names", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "key",
        entityId: "key-456",
        before: {
          password: "oldpassword123",
          secret_key: "secret_value",
          publicData: "this is public",
        },
        after: {
          password: "newpassword456",
          api_token: "token_value",
          publicData: "this is still public",
        },
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.before.password).toBe("[REDACTED: sensitive field name]");
      expect(redacted.before.secret_key).toBe("[REDACTED: sensitive field name]");
      expect(redacted.after.password).toBe("[REDACTED: sensitive field name]");
      expect(redacted.after.api_token).toBe("[REDACTED: sensitive field name]");
      expect(redacted.before.publicData).toBe("this is public");
      expect(redacted.after.publicData).toBe("this is still public");
    });

    it("should handle whitelisted fields", () => {
      const config = createRedactionConfig({
        whitelistFields: ["id", "status", "version", "special_field"],
      });

      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "create",
        entityType: "translation",
        entityId: "trans-456",
        after: {
          id: "trans-456",
          status: "active",
          version: 1,
          special_field: "contains@email.com",
          regular_field: "also@contains.email",
        },
      };

      const redacted = redactSensitiveData(eventRecord, config);

      expect(redacted.after.id).toBe("trans-456");
      expect(redacted.after.status).toBe("active");
      expect(redacted.after.version).toBe(1);
      expect(redacted.after.special_field).toBe("[EMAIL_REDACTED]"); // Not whitelisted, so email gets redacted
      expect(redacted.after.regular_field).toBe("[EMAIL_REDACTED]"); // Email gets completely redacted
    });

    it("should handle long values with length-based redaction", () => {
      const longValue = "a".repeat(150);
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "translation",
        entityId: "trans-456",
        before: {
          value: longValue,
          status: "draft",
        },
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.before.value).toBe(
        "[REDACTED: 150 characters - exceeds 100 chars]",
      );
      expect(redacted.before.status).toBe("draft");
    });

    it("should handle nested objects", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "key",
        entityId: "key-456",
        after: {
          metadata: {
            contact: {
              email: "test@example.com",
              phone: "555-123-4567",
            },
            settings: {
              apiKey: "sk_live_1234567890abcdef1234567890abcdef",
              timeout: 30,
            },
          },
        },
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.after.metadata.contact.email).toBe("[EMAIL_REDACTED]");
      expect(redacted.after.metadata.contact.phone).toBe("[PHONE_REDACTED]");
      expect(redacted.after.metadata.settings.apiKey).toBe(
        "[REDACTED: sensitive field name]",
      );
      expect(redacted.after.metadata.settings.timeout).toBe(30);
    });

    it("should handle arrays", () => {
      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "create",
        entityType: "key",
        entityId: "key-456",
        after: {
          contacts: ["admin@company.com", "support@company.com", "Call (555) 123-4567"],
          tags: ["public", "safe"],
        },
      };

      const redacted = redactSensitiveData(eventRecord);

      expect(redacted.after.contacts[0]).toBe("[EMAIL_REDACTED]");
      expect(redacted.after.contacts[1]).toBe("[EMAIL_REDACTED]");
      expect(redacted.after.contacts[2]).toBe("Call [PHONE_REDACTED]");
      expect(redacted.after.tags).toEqual(["public", "safe"]);
    });

    it("should handle custom redaction config", () => {
      const customConfig = createRedactionConfig({
        maxValueLength: 50,
        enablePatternDetection: false,
        enableFieldNameDetection: false,
      });

      const eventRecord = {
        id: "event-123",
        actor: "user@test.com",
        action: "update",
        entityType: "translation",
        entityId: "trans-456",
        after: {
          value: "This contains test@example.com but should only check length",
          password: "secret123",
        },
      };

      const redacted = redactSensitiveData(eventRecord, customConfig);

      expect(redacted.after.value).toBe("[REDACTED: 59 characters - exceeds 50 chars]");
      expect(redacted.after.password).toBe("secret123"); // Field name detection disabled
    });
  });

  describe("validateRedaction", () => {
    it("should validate that PII patterns are removed", () => {
      const original = "Contact support@company.com or call (555) 123-4567";
      const redacted = "Contact [EMAIL_REDACTED] or call [PHONE_REDACTED]";

      expect(validateRedaction(original, redacted)).toBe(true);
    });

    it("should detect incomplete redaction", () => {
      const original = "Contact support@company.com or call (555) 123-4567";
      const badRedaction = "Contact [EMAIL_REDACTED] or call (555) 123-4567"; // Phone not redacted

      expect(validateRedaction(original, badRedaction)).toBe(false);
    });

    it("should validate that non-PII content is unchanged", () => {
      const original = "This is safe public content";
      const redacted = "This is safe public content";

      expect(validateRedaction(original, redacted)).toBe(true);
    });
  });

  describe("createRedactionConfig", () => {
    it("should merge with default config", () => {
      const custom = createRedactionConfig({
        maxValueLength: 200,
        enablePatternDetection: false,
      });

      expect(custom.maxValueLength).toBe(200);
      expect(custom.enablePatternDetection).toBe(false);
      expect(custom.enableFieldNameDetection).toBe(true); // From default
      expect(custom.whitelistFields).toEqual(DEFAULT_REDACTION_CONFIG.whitelistFields);
    });
  });
});
