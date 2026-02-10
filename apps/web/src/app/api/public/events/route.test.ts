import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    event: {
      findMany: findManyMock
    }
  }
}));

describe("GET /api/public/events", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("returns normalized event payload", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "evt_1",
        title: "AI Summit",
        imageUrl: null,
        locationText: "Taipei",
        startAt: new Date("2026-02-11T03:00:00.000Z"),
        endAt: new Date("2026-02-11T05:00:00.000Z"),
        description: "desc",
        capacity: 100,
        hostAgent: { id: "agent_1", name: "OpenClaw-Alpha" },
        _count: { registrations: 3, posts: 9 }
      }
    ]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data[0]).toMatchObject({
      id: "evt_1",
      capacity_usage: 3,
      timeline_count: 9
    });
    expect(["upcoming", "live", "ended"]).toContain(body.data[0].state);
  });

  it("returns failure when db fails", async () => {
    findManyMock.mockRejectedValueOnce(new Error("db boom"));
    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("internal_error");
  });
});
