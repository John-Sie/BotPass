import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/db";

const fullFlowEnabled = process.env.E2E_FULL_FLOW === "true";
const hasDatabase = Boolean(process.env.DATABASE_URL);

let seededAgentId = "";
let createdEventId = "";
let createdRegistrationId = "";
let createdPostId = "";
let seededApiKey = "";

test.describe("agent full flow", () => {
  test.skip(!fullFlowEnabled || !hasDatabase, "Set E2E_FULL_FLOW=true and DATABASE_URL to run full flow");

  test.beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);
    seededAgentId = `agent_e2e_${suffix}`;
    seededApiKey = `e2e_key_${suffix}`;
    const apiKeyHash = createHash("sha256").update(seededApiKey).digest("hex");

    await prisma.agent.create({
      data: {
        id: seededAgentId,
        name: `OpenClaw-E2E-${suffix}`,
        apiKeyHash,
        ownerName: "E2E Owner",
        ownerEmail: `owner+${suffix}@example.com`,
        ownerSocialUrl: "https://example.com/e2e-owner"
      }
    });

  });

  test.afterAll(async () => {
    if (createdPostId) {
      await prisma.timelineLike.deleteMany({ where: { postId: createdPostId } });
    }
    if (createdEventId) {
      await prisma.timelinePost.deleteMany({ where: { eventId: createdEventId } });
      await prisma.ticket.deleteMany({ where: { registration: { eventId: createdEventId } } });
      await prisma.eventRegistration.deleteMany({ where: { eventId: createdEventId } });
      await prisma.moderationAction.deleteMany({ where: { eventId: createdEventId } });
      await prisma.event.deleteMany({ where: { id: createdEventId } });
    }
    if (seededAgentId) {
      await prisma.rateLimitCounter.deleteMany({ where: { bucketKey: { contains: seededAgentId } } });
      await prisma.auditLog.deleteMany({ where: { actorId: seededAgentId } });
      await prisma.agent.deleteMany({ where: { id: seededAgentId } });
    }
  });

  test("agent can create/register/post/reply/like/ticket/transfer", async ({ request }) => {
    if (!seededApiKey) {
      throw new Error("Missing E2E_AGENT_RAW_KEY");
    }

    const headers = {
      "content-type": "application/json",
      "x-agent-id": seededAgentId,
      "x-api-key": seededApiKey
    };

    const now = Date.now();
    const createEventRes = await request.post("/api/agent/events", {
      headers,
      data: {
        title: "E2E Agent Event",
        location_text: "Taipei",
        start_at: new Date(now + 60_000).toISOString(),
        end_at: new Date(now + 3_600_000).toISOString(),
        description: "A full flow event for E2E validation",
        capacity: 50
      }
    });
    expect(createEventRes.ok()).toBeTruthy();
    const createEventBody = await createEventRes.json();
    createdEventId = createEventBody.data.id;
    expect(createdEventId).toBeTruthy();

    const registerRes = await request.post(`/api/agent/events/${createdEventId}/register`, { headers });
    expect(registerRes.ok()).toBeTruthy();
    const registerBody = await registerRes.json();
    createdRegistrationId = registerBody.data.registration_id;
    expect(createdRegistrationId).toBeTruthy();

    const postRes = await request.post(`/api/agent/events/${createdEventId}/posts`, {
      headers,
      data: { content: "Timeline insight from OpenClaw E2E" }
    });
    expect(postRes.ok()).toBeTruthy();
    const postBody = await postRes.json();
    createdPostId = postBody.data.id;
    expect(createdPostId).toBeTruthy();

    const replyRes = await request.post(`/api/agent/posts/${createdPostId}/replies`, {
      headers,
      data: { content: "Replying to keep the thread active" }
    });
    expect(replyRes.ok()).toBeTruthy();

    const likeRes = await request.post(`/api/agent/posts/${createdPostId}/likes`, { headers });
    expect(likeRes.ok()).toBeTruthy();
    const likeBody = await likeRes.json();
    expect(likeBody.data.like_count).toBeGreaterThanOrEqual(1);

    const ticketRes = await request.get(`/api/agent/registrations/${createdRegistrationId}/ticket`, { headers });
    expect(ticketRes.ok()).toBeTruthy();
    const ticketBody = await ticketRes.json();
    expect(ticketBody.data.registration_id).toBe(createdRegistrationId);

    const transferRes = await request.post(
      `/api/agent/registrations/${createdRegistrationId}/transfer-to-owner`,
      { headers }
    );
    expect(transferRes.ok()).toBeTruthy();
    const transferBody = await transferRes.json();
    expect(transferBody.data.status).toBe("sent");

    const publicTimelineRes = await request.get(`/api/public/events/${createdEventId}/timeline?sort=newest`);
    expect(publicTimelineRes.ok()).toBeTruthy();
    const publicTimelineBody = await publicTimelineRes.json();
    expect(publicTimelineBody.data.items.length).toBeGreaterThanOrEqual(1);
  });
});
