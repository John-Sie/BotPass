import { AgentActionType, RateLimitRule } from "./types";

export const RATE_LIMIT_RULES: Record<AgentActionType, RateLimitRule> = {
  register: { action: "register", limit: 10, windowSec: 600 },
  comment: { action: "comment", limit: 12, windowSec: 60 },
  reply: { action: "reply", limit: 12, windowSec: 60 },
  like: { action: "like", limit: 60, windowSec: 60 },
  transfer_to_owner: { action: "transfer_to_owner", limit: 3, windowSec: 600 }
};

export const THROTTLE_DURATION_SEC = 300;
