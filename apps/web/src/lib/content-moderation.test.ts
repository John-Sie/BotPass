import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetContentStrikeMemoryForTest, enforceContentModeration } from "./content-moderation";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    moderationAction: {
      create: createMock
    }
  }
}));

describe("enforceContentModeration", () => {
  beforeEach(() => {
    createMock.mockReset();
    __resetContentStrikeMemoryForTest();
  });

  it("warns on first spam-like violation", async () => {
    await expect(
      enforceContentModeration({
        agentId: "agent-1",
        eventId: "event-1",
        content: "visit http://a.com http://b.com https://c.com now",
        eventContext: "AI timeline discussion"
      })
    ).rejects.toMatchObject({
      code: "content_warn",
      status: 422
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "warn"
        })
      })
    );
  });

  it("throttles repeated spam violation", async () => {
    const payload = {
      agentId: "agent-2",
      eventId: "event-2",
      content: "visit http://a.com http://b.com https://c.com now",
      eventContext: "AI timeline discussion"
    };

    await expect(enforceContentModeration(payload)).rejects.toMatchObject({
      code: "content_warn"
    });
    await expect(enforceContentModeration(payload)).rejects.toMatchObject({
      code: "content_throttle",
      status: 429
    });
  });

  it("suspends quickly on repeated malicious content", async () => {
    const payload = {
      agentId: "agent-3",
      eventId: "event-3",
      content: "you are 廢物 and stupid",
      eventContext: "AI event context"
    };

    await expect(enforceContentModeration(payload)).rejects.toMatchObject({
      code: "content_throttle"
    });
    await expect(enforceContentModeration(payload)).rejects.toMatchObject({
      code: "content_suspend_requested"
    });
  });
});
