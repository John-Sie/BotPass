import {
  DEFAULT_CONTENT_MODERATION_CONFIG,
  type ContentModerationConfig
} from "@botpass/core";

function parseKeywordList(input: string | undefined, fallback: string[]) {
  if (!input) {
    return fallback;
  }

  const values = input
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return values.length > 0 ? values : fallback;
}

function parseNumber(input: string | undefined, fallback: number, min: number) {
  if (!input) {
    return fallback;
  }

  const value = Number(input);
  if (!Number.isFinite(value) || value < min) {
    return fallback;
  }

  return value;
}

let cached: ContentModerationConfig | null = null;

export function getContentModerationConfig(): ContentModerationConfig {
  if (cached) {
    return cached;
  }

  cached = {
    maliciousKeywords: parseKeywordList(
      process.env.CONTENT_MOD_MALICIOUS_KEYWORDS,
      DEFAULT_CONTENT_MODERATION_CONFIG.maliciousKeywords
    ),
    promoKeywords: parseKeywordList(
      process.env.CONTENT_MOD_PROMO_KEYWORDS,
      DEFAULT_CONTENT_MODERATION_CONFIG.promoKeywords
    ),
    thresholds: {
      urlCountSpam: parseNumber(
        process.env.CONTENT_MOD_URL_COUNT_SPAM,
        DEFAULT_CONTENT_MODERATION_CONFIG.thresholds.urlCountSpam,
        1
      ),
      repeatedCharMin: parseNumber(
        process.env.CONTENT_MOD_REPEATED_CHAR_MIN,
        DEFAULT_CONTENT_MODERATION_CONFIG.thresholds.repeatedCharMin,
        2
      ),
      punctuationFloodMin: parseNumber(
        process.env.CONTENT_MOD_PUNCT_FLOOD_MIN,
        DEFAULT_CONTENT_MODERATION_CONFIG.thresholds.punctuationFloodMin,
        2
      ),
      maxContentLength: parseNumber(
        process.env.CONTENT_MOD_MAX_CONTENT_LENGTH,
        DEFAULT_CONTENT_MODERATION_CONFIG.thresholds.maxContentLength,
        100
      ),
      maxLineCount: parseNumber(
        process.env.CONTENT_MOD_MAX_LINE_COUNT,
        DEFAULT_CONTENT_MODERATION_CONFIG.thresholds.maxLineCount,
        2
      ),
      contextOverlapMin: parseNumber(
        process.env.CONTENT_MOD_CONTEXT_OVERLAP_MIN,
        DEFAULT_CONTENT_MODERATION_CONFIG.thresholds.contextOverlapMin,
        0
      )
    }
  };

  return cached;
}

export function __resetContentModerationConfigCacheForTest() {
  cached = null;
}
