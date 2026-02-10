import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenClawProvider, getOpenClawProviderConfig } from "./index";

afterEach(() => {
  delete process.env.OPENCLAW_PROVIDER_MODE;
  delete process.env.OPENCLAW_ENDPOINT;
  delete process.env.OPENCLAW_TOKEN;
  delete process.env.OPENCLAW_TIMEOUT_MS;
  delete process.env.OPENCLAW_MAX_RETRIES;
  delete process.env.OPENCLAW_RETRY_BACKOFF_MS;
  delete process.env.OPENCLAW_FALLBACK_TO_MOCK;
  delete process.env.OPENCLAW_BASE_PATH;
  delete process.env.NODE_ENV;
});

describe("getOpenClawProviderConfig", () => {
  it("uses sane defaults", () => {
    const config = getOpenClawProviderConfig();

    expect(config).toMatchObject({
      mode: "mock",
      timeoutMs: 8000,
      maxRetries: 2,
      retryBackoffMs: 250,
      basePath: "/tools"
    });
  });

  it("disables fallback by default in production", () => {
    process.env.NODE_ENV = "production";
    process.env.OPENCLAW_PROVIDER_MODE = "real";
    process.env.OPENCLAW_ENDPOINT = "https://provider.example.com";

    const config = getOpenClawProviderConfig();
    expect(config.fallbackToMockOnError).toBe(false);
  });
});

describe("createOpenClawProvider", () => {
  it("returns mock provider by default", async () => {
    const provider = createOpenClawProvider();
    const response = await provider.register_event("evt_123");

    expect(response).toMatchObject({ ok: true, source: "mock", eventId: "evt_123" });
  });

  it("falls back to mock when real mode has no endpoint", async () => {
    process.env.OPENCLAW_PROVIDER_MODE = "real";

    const provider = createOpenClawProvider();
    const response = await provider.like_post("post_abc");

    expect(response).toMatchObject({ ok: true, source: "mock", postId: "post_abc" });
  });

  it("calls real endpoint with configured base path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, source: "real" })
    });

    const provider = createOpenClawProvider({
      mode: "real",
      endpoint: "https://provider.example.com/",
      token: "token-123",
      basePath: "/tools",
      fetchImpl: fetchMock
    });

    await provider.register_event("evt_999");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.example.com/tools/register_event",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer token-123",
          "content-type": "application/json"
        })
      })
    );
  });

  it("retries failed real call and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, source: "real" })
      });

    const provider = createOpenClawProvider({
      mode: "real",
      endpoint: "https://provider.example.com",
      maxRetries: 1,
      retryBackoffMs: 1,
      fetchImpl: fetchMock
    });

    const result = await provider.like_post("post-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, source: "real" });
  });

  it("falls back to mock on real failure when enabled", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("provider down"));

    const provider = createOpenClawProvider({
      mode: "real",
      endpoint: "https://provider.example.com",
      maxRetries: 0,
      fallbackToMockOnError: true,
      fetchImpl: fetchMock
    });

    const result = await provider.transfer_to_owner("reg-1");
    expect(result).toMatchObject({ ok: true, source: "mock", registrationId: "reg-1" });
  });

  it("throws when real call fails and fallback disabled", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("provider down"));

    const provider = createOpenClawProvider({
      mode: "real",
      endpoint: "https://provider.example.com",
      maxRetries: 0,
      fallbackToMockOnError: false,
      fetchImpl: fetchMock
    });

    await expect(provider.transfer_to_owner("reg-1")).rejects.toThrow("provider down");
  });
});
