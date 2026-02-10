import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);

let hostId = "";
let otherHostId = "";
let detailEventId = "";
const seededAgentIds: string[] = [];
const seededEventIds: string[] = [];
const seededPostIds: string[] = [];

test.describe("events filters and pagination", () => {
  test.skip(!hasDatabase, "Set DATABASE_URL to run events UI pagination and filter tests");

  test.beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);
    hostId = `agent_ui_host_${suffix}`;
    otherHostId = `agent_ui_other_${suffix}`;
    const likerIds = [`agent_ui_like_a_${suffix}`, `agent_ui_like_b_${suffix}`, `agent_ui_like_c_${suffix}`];
    seededAgentIds.push(hostId, otherHostId, ...likerIds);

    await prisma.agent.createMany({
      data: seededAgentIds.map((id, index) => ({
        id,
        name: `E2E-${id}`,
        apiKeyHash: createHash("sha256").update(`seed-${id}`).digest("hex"),
        ownerName: `E2E Owner ${index + 1}`,
        ownerEmail: `${id}@example.com`,
        ownerSocialUrl: "https://example.com/e2e"
      }))
    });

    const now = Date.now();
    const eventRows = Array.from({ length: 25 }, (_, i) => {
      const id = `event_ui_${suffix}_${String(i + 1).padStart(2, "0")}`;
      seededEventIds.push(id);
      const startAt = new Date(now + (i + 1) * 86_400_000);
      const endAt = new Date(startAt.getTime() + 7_200_000);
      return {
        id,
        title: `E2E Upcoming ${String(i + 1).padStart(2, "0")}`,
        locationText: "Taipei",
        startAt,
        endAt,
        description: `E2E upcoming event ${i + 1}`,
        hostAgentId: hostId,
        capacity: 200
      };
    });

    detailEventId = eventRows[12]?.id ?? "";

    const otherHostEventId = `event_ui_other_${suffix}`;
    seededEventIds.push(otherHostEventId);
    eventRows.push({
      id: otherHostEventId,
      title: "E2E Other Host Event",
      locationText: "Taichung",
      startAt: new Date(now + 10 * 86_400_000),
      endAt: new Date(now + 10 * 86_400_000 + 7_200_000),
      description: "Hosted by the alternate host",
      hostAgentId: otherHostId,
      capacity: 50
    });

    await prisma.event.createMany({ data: eventRows });

    const postRows = Array.from({ length: 15 }, (_, i) => {
      const id = `post_ui_${suffix}_${String(i + 1).padStart(2, "0")}`;
      seededPostIds.push(id);
      return {
        id,
        eventId: detailEventId,
        agentId: hostId,
        content: `Cursor ranking post ${i + 1}`,
        createdAt: new Date(now - i * 60_000),
        status: "active" as const
      };
    });
    await prisma.timelinePost.createMany({ data: postRows });

    const likeRows = postRows.flatMap((post, index) => {
      const likeCount = index % 4;
      return likerIds.slice(0, likeCount).map((agentId) => ({ postId: post.id, agentId }));
    });

    if (likeRows.length > 0) {
      await prisma.timelineLike.createMany({ data: likeRows });
    }
  });

  test.afterAll(async () => {
    if (seededPostIds.length > 0) {
      await prisma.timelineLike.deleteMany({ where: { postId: { in: seededPostIds } } });
      await prisma.timelinePost.deleteMany({ where: { id: { in: seededPostIds } } });
    }
    if (seededEventIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { registration: { eventId: { in: seededEventIds } } } });
      await prisma.eventRegistration.deleteMany({ where: { eventId: { in: seededEventIds } } });
      await prisma.moderationAction.deleteMany({ where: { eventId: { in: seededEventIds } } });
      await prisma.event.deleteMany({ where: { id: { in: seededEventIds } } });
    }
    if (seededAgentIds.length > 0) {
      await prisma.timelineLike.deleteMany({ where: { agentId: { in: seededAgentIds } } });
      await prisma.timelinePost.deleteMany({ where: { agentId: { in: seededAgentIds } } });
      await prisma.rateLimitCounter.deleteMany({ where: { bucketKey: { in: seededAgentIds } } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: seededAgentIds } } });
      await prisma.agent.deleteMany({ where: { id: { in: seededAgentIds } } });
    }
  });

  test("list preserves filters through locale switch and supports paging", async ({ page }) => {
    await page.goto(`/zh-TW/events?status=upcoming&host=${hostId}&page=2`);
    await expect(page.getByText(/第\s*2\s*頁/)).toBeVisible();
    await expect(page.getByRole("link", { name: "上一頁" })).toBeVisible();
    await expect(page.getByRole("link", { name: "下一頁" })).toBeVisible();

    await page.getByRole("link", { name: /^EN$/ }).click();
    let url = new URL(page.url());
    expect(url.pathname).toBe("/en/events");
    expect(url.searchParams.get("status")).toBe("upcoming");
    expect(url.searchParams.get("host")).toBe(hostId);
    expect(url.searchParams.get("page")).toBe("2");

    await page.getByRole("link", { name: "Reset" }).click();
    url = new URL(page.url());
    expect(url.pathname).toBe("/en/events");
    expect(url.searchParams.toString()).toBe("");
  });

  test("detail keeps list-state and uses cursor pagination for most liked", async ({ page }) => {
    await page.goto(`/zh-TW/events?status=upcoming&host=${hostId}&page=2`);

    const detailCard = page.locator("article.card.event-card").filter({ hasText: "E2E Upcoming 13" }).first();
    await detailCard.getByRole("link", { name: /查看活動|View event/ }).click();
    let url = new URL(page.url());
    expect(url.pathname).toBe(`/zh-TW/events/${detailEventId}`);
    expect(url.searchParams.get("from_status")).toBe("upcoming");
    expect(url.searchParams.get("from_host")).toBe(hostId);
    expect(url.searchParams.get("from_page")).toBe("2");

    await page.getByRole("link", { name: "最熱門" }).click();
    await page.getByRole("link", { name: "下一頁" }).click();

    url = new URL(page.url());
    expect(url.searchParams.get("sort")).toBe("most_liked");
    expect(url.searchParams.get("cursor")).toBeTruthy();
    expect(url.searchParams.get("trail")).toBeTruthy();
    expect(url.searchParams.get("page")).toBeNull();
    expect(url.searchParams.get("from_status")).toBe("upcoming");
    expect(url.searchParams.get("from_host")).toBe(hostId);
    expect(url.searchParams.get("from_page")).toBe("2");

    await page.getByRole("link", { name: /^EN$/ }).click();
    url = new URL(page.url());
    expect(url.pathname).toBe(`/en/events/${detailEventId}`);
    expect(url.searchParams.get("cursor")).toBeTruthy();
    expect(url.searchParams.get("trail")).toBeTruthy();
    expect(url.searchParams.get("from_host")).toBe(hostId);

    await page.getByRole("link", { name: "Back to events" }).click();
    url = new URL(page.url());
    expect(url.pathname).toBe("/en/events");
    expect(url.searchParams.get("status")).toBe("upcoming");
    expect(url.searchParams.get("host")).toBe(hostId);
    expect(url.searchParams.get("page")).toBe("2");
  });
});
