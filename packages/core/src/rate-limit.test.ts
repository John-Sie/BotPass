import { describe, expect, it } from "vitest";
import { checkRateLimit, MemoryRateLimitStore } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows within limit and blocks after", async () => {
    const store = new MemoryRateLimitStore();

    const first = await checkRateLimit({
      store,
      key: "agent-1:comment",
      limit: 2,
      windowSec: 60
    });

    const second = await checkRateLimit({
      store,
      key: "agent-1:comment",
      limit: 2,
      windowSec: 60
    });

    const third = await checkRateLimit({
      store,
      key: "agent-1:comment",
      limit: 2,
      windowSec: 60
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});
