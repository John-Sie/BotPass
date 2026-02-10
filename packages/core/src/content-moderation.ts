export type ContentViolationType = "spam" | "flood" | "malicious_attack" | "off_topic";
export type ContentModerationAction = "allow" | "warn" | "throttle" | "suspend_request";

export interface ContentModerationResult {
  violation: ContentViolationType | null;
  score: number;
  reasons: string[];
}

export interface ContentModerationConfig {
  maliciousKeywords: string[];
  promoKeywords: string[];
  thresholds: {
    urlCountSpam: number;
    repeatedCharMin: number;
    punctuationFloodMin: number;
    maxContentLength: number;
    maxLineCount: number;
    contextOverlapMin: number;
  };
}

export const DEFAULT_CONTENT_MODERATION_CONFIG: ContentModerationConfig = {
  maliciousKeywords: [
    "kill",
    "die",
    "stupid",
    "idiot",
    "垃圾",
    "去死",
    "白痴",
    "智障",
    "幹你",
    "廢物"
  ],
  promoKeywords: [
    "airdrop",
    "discount",
    "promo",
    "coupon",
    "token sale",
    "loan",
    "casino",
    "博彩",
    "優惠碼",
    "加密群",
    "外匯群"
  ],
  thresholds: {
    urlCountSpam: 3,
    repeatedCharMin: 12,
    punctuationFloodMin: 8,
    maxContentLength: 2200,
    maxLineCount: 35,
    contextOverlapMin: 0.2
  }
};

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function overlapRatio(content: string, context: string) {
  const contentTokens = new Set(tokenize(content));
  const contextTokens = new Set(tokenize(context));

  if (contentTokens.size === 0 || contextTokens.size < 4) {
    return 1;
  }

  let overlap = 0;
  for (const token of contentTokens) {
    if (contextTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / contentTokens.size;
}

export function analyzeTimelineContent(
  content: string,
  eventContext?: string,
  config: ContentModerationConfig = DEFAULT_CONTENT_MODERATION_CONFIG
): ContentModerationResult {
  const value = content.trim();
  const lower = value.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const urlCount = (lower.match(/https?:\/\/|www\./g) ?? []).length;
  if (urlCount >= config.thresholds.urlCountSpam) {
    score += 4;
    reasons.push("multiple_links");
  }

  if (new RegExp(`(.)\\1{${Math.max(config.thresholds.repeatedCharMin - 1, 1)},}`, "u").test(value)) {
    score += 3;
    reasons.push("repeated_characters");
  }

  if (new RegExp(`(!|\\?){${Math.max(config.thresholds.punctuationFloodMin, 2)},}`).test(value)) {
    score += 2;
    reasons.push("punctuation_flood");
  }

  if (
    value.length > config.thresholds.maxContentLength ||
    value.split("\n").length > config.thresholds.maxLineCount
  ) {
    score += 3;
    reasons.push("excessive_length");
  }

  if (config.maliciousKeywords.some((keyword) => lower.includes(keyword))) {
    score += 5;
    reasons.push("malicious_keywords");
  }

  const hasPromo = config.promoKeywords.some((keyword) => lower.includes(keyword));
  if (hasPromo) {
    score += 2;
    reasons.push("promo_keywords");
  }

  if (eventContext && hasPromo && overlapRatio(value, eventContext) < config.thresholds.contextOverlapMin) {
    score += 3;
    reasons.push("context_mismatch");
  }

  if (reasons.includes("malicious_keywords")) {
    return { violation: "malicious_attack", score, reasons };
  }

  if (reasons.includes("multiple_links") || reasons.includes("repeated_characters")) {
    return { violation: "spam", score, reasons };
  }

  if (reasons.includes("punctuation_flood") || reasons.includes("excessive_length")) {
    return { violation: "flood", score, reasons };
  }

  if (reasons.includes("context_mismatch")) {
    return { violation: "off_topic", score, reasons };
  }

  return { violation: null, score, reasons };
}

export function decideContentAction(input: {
  violation: ContentViolationType | null;
  previousStrikes: number;
}): ContentModerationAction {
  if (!input.violation) {
    return "allow";
  }

  if (input.violation === "malicious_attack") {
    return input.previousStrikes >= 1 ? "suspend_request" : "throttle";
  }

  if (input.previousStrikes <= 0) {
    return "warn";
  }

  if (input.previousStrikes >= 3) {
    return "suspend_request";
  }

  return "throttle";
}
