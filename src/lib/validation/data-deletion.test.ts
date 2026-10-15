import { describe, expect, it } from "vitest";
import { deleteCommenterDataSchema, igUsernameSchema } from "./data-deletion";

describe("igUsernameSchema", () => {
  it("accepts Instagram usernames and strips a leading @", () => {
    expect(igUsernameSchema.parse("jane.doe_99")).toBe("jane.doe_99");
    expect(igUsernameSchema.parse("@Jane.Doe")).toBe("Jane.Doe");
    expect(igUsernameSchema.parse("  @jane  ")).toBe("jane");
    expect(igUsernameSchema.parse("a".repeat(30))).toBe("a".repeat(30));
  });
  it("rejects invalid characters", () => {
    for (const bad of ["jane doe", "jane-doe", "jané", "@@jane", "jane@", "j/ane", "%", "😀"]) {
      expect(igUsernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
  it("rejects usernames longer than 30 characters", () => {
    expect(igUsernameSchema.safeParse("a".repeat(31)).success).toBe(false);
    expect(igUsernameSchema.safeParse(`@${"a".repeat(31)}`).success).toBe(false);
  });
  it("rejects empty input", () => {
    expect(igUsernameSchema.safeParse("").success).toBe(false);
    expect(igUsernameSchema.safeParse("   ").success).toBe(false);
    expect(igUsernameSchema.safeParse("@").success).toBe(false);
  });
});

describe("deleteCommenterDataSchema", () => {
  it("accepts a commenter id, a username or both", () => {
    expect(deleteCommenterDataSchema.parse({ commenterId: "17841400000000001" })).toEqual({
      commenterId: "17841400000000001",
    });
    expect(deleteCommenterDataSchema.parse({ username: "@Jane" })).toEqual({ username: "Jane" });
    expect(deleteCommenterDataSchema.safeParse({ commenterId: "123", username: "jane" }).success).toBe(true);
  });
  it("requires at least one of them", () => {
    const res = deleteCommenterDataSchema.safeParse({});
    expect(res.success).toBe(false);
    expect(res.error!.issues[0]!.path).toEqual(["username"]);
  });
  it("validates the commenter id", () => {
    expect(deleteCommenterDataSchema.safeParse({ commenterId: "" }).success).toBe(false);
    expect(deleteCommenterDataSchema.safeParse({ commenterId: "12 34" }).success).toBe(false);
    expect(deleteCommenterDataSchema.safeParse({ commenterId: "1".repeat(65) }).success).toBe(false);
    expect(deleteCommenterDataSchema.safeParse({ commenterId: "Abc123" }).success).toBe(true);
  });
  it("rejects an empty username", () => {
    expect(deleteCommenterDataSchema.safeParse({ username: "" }).success).toBe(false);
  });
});
