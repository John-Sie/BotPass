import { RateLimitResult } from "./types";

interface RateLimitStore {
  incr(key: string, windowSec: number): Promise<{ count: number; resetAt: Date }>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();

  async incr(key: string, windowSec: number): Promise<{ count: number; resetAt: Date }> {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || existing.expiresAt <= now) {
      const expiresAt = now + windowSec * 1000;
      this.counters.set(key, { count: 1, expiresAt });
      return { count: 1, resetAt: new Date(expiresAt) };
    }

    existing.count += 1;
    this.counters.set(key, existing);
    return { count: existing.count, resetAt: new Date(existing.expiresAt) };
  }
}

const memoryStore = new MemoryRateLimitStore();

export async function checkRateLimit(input: {
  store?: RateLimitStore;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const store = input.store ?? memoryStore;
  const { count, resetAt } = await store.incr(input.key, input.windowSec);

  return {
    allowed: count <= input.limit,
    remaining: Math.max(input.limit - count, 0),
    resetAt
  };
}

export { MemoryRateLimitStore };
export type { RateLimitStore };
