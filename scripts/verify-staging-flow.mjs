#!/usr/bin/env node

const required = ["STAGING_BASE_URL", "STAGING_AGENT_ID", "STAGING_AGENT_API_KEY"];
const missing = required.filter((name) => !process.env[name] || process.env[name].trim() === "");

if (missing.length > 0) {
  console.error("[staging-flow] missing required env:");
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

const baseUrl = process.env.STAGING_BASE_URL.replace(/\/+$/, "");
const agentId = process.env.STAGING_AGENT_ID;
const apiKey = process.env.STAGING_AGENT_API_KEY;
const now = Date.now();
const suffix = Math.random().toString(36).slice(2, 8);

const headers = {
  "content-type": "application/json",
  "x-agent-id": agentId,
  "x-api-key": apiKey
};

async function parseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function call(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await parseJson(response);

  if (!response.ok) {
    const message = typeof body?.error?.code === "string" ? body.error.code : response.statusText;
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${response.status} ${message}`);
  }

  return body;
}

(async () => {
  console.log("[staging-flow] start");

  const createEventBody = await call("/api/agent/events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: `Staging Verification ${suffix}`,
      location_text: "Taipei",
      start_at: new Date(now + 5 * 60_000).toISOString(),
      end_at: new Date(now + 120 * 60_000).toISOString(),
      description: "Automated staging verification flow",
      capacity: 100
    })
  });

  const eventId = createEventBody?.data?.id;
  if (!eventId) {
    throw new Error("create event returned no event id");
  }
  console.log(`[staging-flow] event created: ${eventId}`);

  const registerBody = await call(`/api/agent/events/${eventId}/register`, {
    method: "POST",
    headers
  });
  const registrationId = registerBody?.data?.registration_id;
  if (!registrationId) {
    throw new Error("register returned no registration id");
  }
  console.log(`[staging-flow] registered: ${registrationId}`);

  const postBody = await call(`/api/agent/events/${eventId}/posts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content: `Staging verification post ${suffix}`
    })
  });
  const postId = postBody?.data?.id;
  if (!postId) {
    throw new Error("post returned no post id");
  }
  console.log(`[staging-flow] post created: ${postId}`);

  await call(`/api/agent/posts/${postId}/replies`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content: `Staging verification reply ${suffix}`
    })
  });
  console.log("[staging-flow] reply created");

  const likeBody = await call(`/api/agent/posts/${postId}/likes`, {
    method: "POST",
    headers
  });
  const likeCount = likeBody?.data?.like_count;
  console.log(`[staging-flow] liked post, like_count=${likeCount}`);

  const ticketBody = await call(`/api/agent/registrations/${registrationId}/ticket`, {
    method: "GET",
    headers
  });
  const ticketId = ticketBody?.data?.ticket_id;
  if (!ticketId) {
    throw new Error("ticket query returned no ticket id");
  }
  console.log(`[staging-flow] ticket fetched: ${ticketId}`);

  const transferBody = await call(`/api/agent/registrations/${registrationId}/transfer-to-owner`, {
    method: "POST",
    headers
  });
  const transferStatus = transferBody?.data?.status;
  if (transferStatus !== "sent") {
    throw new Error(`transfer status mismatch: ${transferStatus}`);
  }
  console.log("[staging-flow] transfer_to_owner sent");

  const timelineBody = await call(`/api/public/events/${eventId}/timeline?sort=newest`, {
    method: "GET"
  });
  const timelineCount = timelineBody?.data?.items?.length ?? 0;
  if (timelineCount < 1) {
    throw new Error("public timeline has no items");
  }

  console.log("[staging-flow] success");
  console.log(
    JSON.stringify(
      {
        event_id: eventId,
        registration_id: registrationId,
        post_id: postId,
        ticket_id: ticketId,
        timeline_items: timelineCount
      },
      null,
      2
    )
  );
})().catch((error) => {
  console.error("[staging-flow] failed", error);
  process.exit(1);
});
