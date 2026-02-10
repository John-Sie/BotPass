import { describe, expect, it } from "vitest";
import { evaluateModeration } from "./moderation";

describe("evaluateModeration", () => {
  it("warns first, then throttles, then suspend_request", () => {
    const agentId = `agent-${Date.now()}`;

    expect(evaluateModeration(agentId, true).decision).toBe("warn");
    expect(evaluateModeration(agentId, true).decision).toBe("throttle");
    expect(evaluateModeration(agentId, true).decision).toBe("throttle");
    expect(evaluateModeration(agentId, true).decision).toBe("throttle");
    expect(evaluateModeration(agentId, true).decision).toBe("suspend_request");
  });
});
