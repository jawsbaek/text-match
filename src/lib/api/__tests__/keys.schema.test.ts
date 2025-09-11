import { describe, expect, it } from "vitest";
import { createKeySchema } from "~/routes/api/keys";

describe("createKeySchema", () => {
  it("accepts minimal valid body", () => {
    const result = createKeySchema.safeParse({ id: "k1", keyName: "home.title" });
    expect(result.success).toBe(true);
  });

  it("rejects empty keyName", () => {
    const result = createKeySchema.safeParse({ id: "k1", keyName: "" });
    expect(result.success).toBe(false);
  });

  it("allows optional tags array of strings", () => {
    const result = createKeySchema.safeParse({
      id: "k2",
      keyName: "a.b",
      tags: ["x", "y"],
    });
    expect(result.success).toBe(true);
  });
});
