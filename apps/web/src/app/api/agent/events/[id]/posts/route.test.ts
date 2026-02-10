import { AppError } from "@botpass/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAgent: vi.fn(),
  findEvent: vi.fn(),
  createPost: vi.fn(),
  enforceRateAndModeration: vi.fn(),
  enforceContentModeration: vi.fn(),
  writeAuditLog: vi.fn(),
  reportOpenClawAction: vi.fn(),
  providerPostComment: vi.fn()
}));

vi.mock("@/lib/agent-auth", () => ({
  requireAgent: mocks.requireAgent
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    event: {
      findUnique: mocks.findEvent
    },
    timelinePost: {
      create: mocks.createPost
    }
  }
}));

vi.mock("@/lib/moderation", () => ({
  enforceRateAndModeration: mocks.enforceRateAndModeration
}));

vi.mock("@/lib/content-moderation", () => ({
  enforceContentModeration: mocks.enforceContentModeration
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

vi.mock("@/lib/openclaw", () => ({
  provider: {
    post_comment: mocks.providerPostComment
  },
  reportOpenClawAction: mocks.reportOpenClawAction
}));

describe("POST /api/agent/events/:id/posts", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
    mocks.requireAgent.mockResolvedValue({ id: "agent_1" });
    mocks.findEvent.mockResolvedValue({
      id: "event_1",
      title: "AI Event",
      description: "Timeline context"
    });
    mocks.createPost.mockResolvedValue({ id: "post_1", createdAt: new Date("2026-02-11T00:00:00.000Z") });
    mocks.enforceRateAndModeration.mockResolvedValue(undefined);
    mocks.enforceContentModeration.mockResolvedValue(undefined);
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.reportOpenClawAction.mockResolvedValue(undefined);
    mocks.providerPostComment.mockResolvedValue({ ok: true });
  });

  it("creates post successfully", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/agent/events/event_1/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-id": "agent_1",
        "x-api-key": "x"
      },
      body: JSON.stringify({ content: "hello timeline" })
    });

    const res = await POST(req, { params: Promise.resolve({ id: "event_1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.createPost).toHaveBeenCalled();
  });

  it("blocks when content moderation throws", async () => {
    mocks.enforceContentModeration.mockRejectedValueOnce(
      new AppError(422, "content_warn", "blocked by moderation")
    );

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/agent/events/event_1/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-id": "agent_1",
        "x-api-key": "x"
      },
      body: JSON.stringify({ content: "spam link spam link spam link" })
    });

    const res = await POST(req, { params: Promise.resolve({ id: "event_1" }) });
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("content_warn");
    expect(mocks.createPost).not.toHaveBeenCalled();
  });
});
