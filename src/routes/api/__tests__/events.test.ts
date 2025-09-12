import { describe, expect, it } from "vitest";
import { eventsQuerySchema } from "~/routes/api/events";

describe("Events API Query Schema", () => {
  describe("eventsQuerySchema validation", () => {
    it("should validate valid query parameters", () => {
      const validQuery = {
        entity: "key",
        entityId: "test-key-123",
        actor: "user@example.com",
        action: "create",
        startDate: "2024-11-01T00:00:00.000Z",
        endDate: "2024-11-30T23:59:59.999Z",
        limit: "25",
        offset: "0",
      };

      const result = eventsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          entity: "key",
          entityId: "test-key-123",
          actor: "user@example.com",
          action: "create",
          startDate: "2024-11-01T00:00:00.000Z",
          endDate: "2024-11-30T23:59:59.999Z",
          limit: 25,
          offset: 0,
        });
      }
    });

    it("should apply defaults for limit and offset", () => {
      const minimalQuery = {};

      const result = eventsQuerySchema.safeParse(minimalQuery);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it("should reject invalid entity types", () => {
      const invalidQuery = {
        entity: "invalid-entity",
      };

      const result = eventsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["entity"]);
        expect(result.error.issues[0].code).toBe("invalid_value");
      }
    });

    it("should reject invalid action types", () => {
      const invalidQuery = {
        action: "invalid-action",
      };

      const result = eventsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["action"]);
        expect(result.error.issues[0].code).toBe("invalid_value");
      }
    });

    it("should reject invalid datetime formats", () => {
      const invalidQuery = {
        startDate: "not-a-date",
      };

      const result = eventsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["startDate"]);
      }
    });

    it("should enforce limit constraints", () => {
      const tooHighLimit = {
        limit: "200",
      };

      const result = eventsQuerySchema.safeParse(tooHighLimit);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["limit"]);
        expect(result.error.issues[0].code).toBe("too_big");
      }
    });

    it("should enforce offset constraints", () => {
      const negativeOffset = {
        offset: "-1",
      };

      const result = eventsQuerySchema.safeParse(negativeOffset);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["offset"]);
        expect(result.error.issues[0].code).toBe("too_small");
      }
    });

    it("should coerce string numbers to integers", () => {
      const stringNumbers = {
        limit: "30",
        offset: "10",
      };

      const result = eventsQuerySchema.safeParse(stringNumbers);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.limit).toBe(30);
        expect(result.data.offset).toBe(10);
        expect(typeof result.data.limit).toBe("number");
        expect(typeof result.data.offset).toBe("number");
      }
    });
  });
});
