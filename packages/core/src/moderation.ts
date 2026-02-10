import { ModerationDecision } from "./types";

interface ModerationMemory {
  warnings: number;
  throttledUntil?: number;
  exceededCount: number;
}

const memory = new Map<string, ModerationMemory>();

export function evaluateModeration(agentId: string, exceededRateLimit: boolean): {
  decision: ModerationDecision;
  throttledUntil?: Date;
} {
  if (!exceededRateLimit) {
    return { decision: "allow" };
  }

  const current = memory.get(agentId) ?? { warnings: 0, exceededCount: 0 };
  current.exceededCount += 1;

  if (current.exceededCount === 1) {
    current.warnings += 1;
    memory.set(agentId, current);
    return { decision: "warn" };
  }

  if (current.exceededCount <= 4) {
    const throttledUntil = Date.now() + 300 * 1000;
    current.throttledUntil = throttledUntil;
    memory.set(agentId, current);
    return { decision: "throttle", throttledUntil: new Date(throttledUntil) };
  }

  memory.set(agentId, current);
  return { decision: "suspend_request" };
}

export function isAgentThrottled(agentId: string): boolean {
  const current = memory.get(agentId);
  if (!current || !current.throttledUntil) {
    return false;
  }

  return current.throttledUntil > Date.now();
}
