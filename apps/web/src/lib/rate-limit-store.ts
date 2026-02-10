import { Redis } from "@upstash/redis";
import type { RateLimitStore } from "@botpass/core";

class UpstashRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async incr(key: string, windowSec: number): Promise<{ count: number; resetAt: Date }> {
    const windowIndex = Math.floor(Date.now() / (windowSec * 1000));
    const fullKey = `${key}:${windowIndex}`;
    const count = await this.redis.incr(fullKey);

    if (count === 1) {
      await this.redis.expire(fullKey, windowSec);
    }

    const resetAt = new Date((windowIndex + 1) * windowSec * 1000);
    return { count, resetAt };
  }
}

let store: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore | undefined {
  if (store) {
    return store;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return undefined;
  }

  store = new UpstashRateLimitStore(url, token);
  return store;
}
