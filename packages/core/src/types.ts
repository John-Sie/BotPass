export type EventState = "upcoming" | "live" | "ended";

export type TimelineSort = "newest" | "most_liked";

export type AgentActionType =
  | "register"
  | "comment"
  | "reply"
  | "like"
  | "transfer_to_owner";

export type ModerationDecision = "allow" | "warn" | "throttle" | "suspend_request";

export interface RateLimitRule {
  action: AgentActionType;
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}
