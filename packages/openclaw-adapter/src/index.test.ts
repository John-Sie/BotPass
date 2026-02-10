import { describe, expect, it } from "vitest";
import { createOpenClawProvider } from "./index";

describe("createOpenClawProvider", () => {
  it("returns mock provider by default", async () => {
    delete process.env.OPENCLAW_PROVIDER_MODE;
    delete process.env.OPENCLAW_ENDPOINT;

    const provider = createOpenClawProvider();
    const response = await provider.register_event("evt_123");

    expect(response).toMatchObject({ ok: true, source: "mock", eventId: "evt_123" });
  });

  it("falls back to mock when real mode has no endpoint", async () => {
    process.env.OPENCLAW_PROVIDER_MODE = "real";
    delete process.env.OPENCLAW_ENDPOINT;

    const provider = createOpenClawProvider();
    const response = await provider.like_post("post_abc");

    expect(response).toMatchObject({ ok: true, source: "mock", postId: "post_abc" });
  });
});
