import { describe, expect, it } from "vitest";
import { statusBreakdownFromCounts } from "./analytics";

describe("statusBreakdownFromCounts", () => {
  it("drops empty statuses and sorts by count, ties in lifecycle order", () => {
    expect(
      statusBreakdownFromCounts({ received: 0, processing: 1, skipped: 3, sent: 5, partial: 1, failed: 3 }),
    ).toEqual([
      { status: "sent", count: 5 },
      { status: "skipped", count: 3 },
      { status: "failed", count: 3 },
      { status: "processing", count: 1 },
      { status: "partial", count: 1 },
    ]);
  });

  it("returns an empty list when nothing happened", () => {
    expect(
      statusBreakdownFromCounts({ received: 0, processing: 0, skipped: 0, sent: 0, partial: 0, failed: 0 }),
    ).toEqual([]);
  });
});
