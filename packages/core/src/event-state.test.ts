import { describe, expect, it } from "vitest";
import { getEventState } from "./event-state";

describe("getEventState", () => {
  const start = new Date("2026-01-01T10:00:00.000Z");
  const end = new Date("2026-01-01T12:00:00.000Z");

  it("returns upcoming before start", () => {
    expect(getEventState(start, end, new Date("2026-01-01T09:59:59.000Z"))).toBe("upcoming");
  });

  it("returns live between start and end", () => {
    expect(getEventState(start, end, new Date("2026-01-01T10:30:00.000Z"))).toBe("live");
  });

  it("returns ended at and after end", () => {
    expect(getEventState(start, end, new Date("2026-01-01T12:00:00.000Z"))).toBe("ended");
  });
});
