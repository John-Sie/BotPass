import { afterEach, describe, expect, it } from "vitest";
import {
  __resetContentModerationConfigCacheForTest,
  getContentModerationConfig
} from "@/lib/moderation-config";

describe("getContentModerationConfig", () => {
  afterEach(() => {
    delete process.env.CONTENT_MOD_MALICIOUS_KEYWORDS;
    delete process.env.CONTENT_MOD_PROMO_KEYWORDS;
    delete process.env.CONTENT_MOD_URL_COUNT_SPAM;
    delete process.env.CONTENT_MOD_REPEATED_CHAR_MIN;
    delete process.env.CONTENT_MOD_PUNCT_FLOOD_MIN;
    delete process.env.CONTENT_MOD_MAX_CONTENT_LENGTH;
    delete process.env.CONTENT_MOD_MAX_LINE_COUNT;
    delete process.env.CONTENT_MOD_CONTEXT_OVERLAP_MIN;
    __resetContentModerationConfigCacheForTest();
  });

  it("uses defaults when env is empty", () => {
    const config = getContentModerationConfig();
    expect(config.thresholds.urlCountSpam).toBe(3);
    expect(config.maliciousKeywords.length).toBeGreaterThan(0);
  });

  it("overrides values from env", () => {
    process.env.CONTENT_MOD_URL_COUNT_SPAM = "5";
    process.env.CONTENT_MOD_MALICIOUS_KEYWORDS = "badword1,badword2";
    process.env.CONTENT_MOD_CONTEXT_OVERLAP_MIN = "0.35";
    __resetContentModerationConfigCacheForTest();

    const config = getContentModerationConfig();
    expect(config.thresholds.urlCountSpam).toBe(5);
    expect(config.thresholds.contextOverlapMin).toBe(0.35);
    expect(config.maliciousKeywords).toEqual(["badword1", "badword2"]);
  });
});
