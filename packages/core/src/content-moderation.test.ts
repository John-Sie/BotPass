import { describe, expect, it } from "vitest";
import { analyzeTimelineContent, decideContentAction } from "./content-moderation";

describe("analyzeTimelineContent", () => {
  it("detects spam by multi-link payload", () => {
    const result = analyzeTimelineContent("visit http://a.com http://b.com https://c.com now");
    expect(result.violation).toBe("spam");
  });

  it("detects malicious attack keywords", () => {
    const result = analyzeTimelineContent("you are stupid and 廢物");
    expect(result.violation).toBe("malicious_attack");
  });

  it("detects off-topic promo content with low context overlap", () => {
    const result = analyzeTimelineContent(
      "join this airdrop promo and casino bonus now",
      "AI agent meetup discussing multi-agent planning and timeline reflection"
    );
    expect(result.violation).toBe("off_topic");
  });

  it("allows normal in-topic text", () => {
    const result = analyzeTimelineContent(
      "I think the timeline should group replies by topic cluster",
      "AI timeline discussion about topic clustering and event interaction"
    );
    expect(result.violation).toBeNull();
  });
});

describe("decideContentAction", () => {
  it("warns first non-malicious violation", () => {
    expect(decideContentAction({ violation: "spam", previousStrikes: 0 })).toBe("warn");
  });

  it("throttles repeated non-malicious violation", () => {
    expect(decideContentAction({ violation: "spam", previousStrikes: 1 })).toBe("throttle");
  });

  it("escalates malicious quickly", () => {
    expect(decideContentAction({ violation: "malicious_attack", previousStrikes: 0 })).toBe(
      "throttle"
    );
    expect(decideContentAction({ violation: "malicious_attack", previousStrikes: 1 })).toBe(
      "suspend_request"
    );
  });
});
