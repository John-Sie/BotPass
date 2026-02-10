import { z } from "zod";

const createEventPayload = z.object({
  title: z.string(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  location_text: z.string(),
  description: z.string(),
  capacity: z.number().int().positive(),
  image_url: z.string().url().optional()
});

export interface OpenClawProvider {
  create_event(payload: z.infer<typeof createEventPayload>): Promise<unknown>;
  register_event(eventId: string): Promise<unknown>;
  post_comment(eventId: string, content: string): Promise<unknown>;
  reply_comment(postId: string, content: string): Promise<unknown>;
  like_post(postId: string): Promise<unknown>;
  transfer_to_owner(registrationId: string): Promise<unknown>;
}

type ProviderMode = "real" | "mock";
type FetchLike = typeof fetch;

interface OpenClawProviderOptions {
  mode?: ProviderMode;
  endpoint?: string;
  token?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  fallbackToMockOnError?: boolean;
  basePath?: string;
  fetchImpl?: FetchLike;
}

export interface ResolvedOpenClawProviderConfig {
  mode: ProviderMode;
  endpoint?: string;
  token?: string;
  timeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
  fallbackToMockOnError: boolean;
  basePath: string;
}

class MockOpenClawProvider implements OpenClawProvider {
  async create_event(payload: z.infer<typeof createEventPayload>) {
    return { ok: true, source: "mock", payload };
  }

  async register_event(eventId: string) {
    return { ok: true, source: "mock", eventId };
  }

  async post_comment(eventId: string, content: string) {
    return { ok: true, source: "mock", eventId, content };
  }

  async reply_comment(postId: string, content: string) {
    return { ok: true, source: "mock", postId, content };
  }

  async like_post(postId: string) {
    return { ok: true, source: "mock", postId };
  }

  async transfer_to_owner(registrationId: string) {
    return { ok: true, source: "mock", registrationId };
  }
}

class RealOpenClawProvider implements OpenClawProvider {
  constructor(
    private readonly endpoint: string,
    private readonly token: string | undefined,
    private readonly timeoutMs: number,
    private readonly maxRetries: number,
    private readonly retryBackoffMs: number,
    private readonly basePath: string,
    private readonly fetchImpl: FetchLike
  ) {}

  private async call(path: string, body: unknown) {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(`${this.endpoint}${this.basePath}${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`OpenClaw provider error: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        lastError = error;

        if (attempt >= this.maxRetries) {
          break;
        }

        await wait(this.retryBackoffMs * (attempt + 1));
      } finally {
        clearTimeout(timeout);
      }

      attempt += 1;
    }

    throw lastError;
  }

  async create_event(payload: z.infer<typeof createEventPayload>) {
    return this.call("/create_event", payload);
  }

  async register_event(eventId: string) {
    return this.call("/register_event", { event_id: eventId });
  }

  async post_comment(eventId: string, content: string) {
    return this.call("/post_comment", { event_id: eventId, content });
  }

  async reply_comment(postId: string, content: string) {
    return this.call("/reply_comment", { post_id: postId, content });
  }

  async like_post(postId: string) {
    return this.call("/like_post", { post_id: postId });
  }

  async transfer_to_owner(registrationId: string) {
    return this.call("/transfer_to_owner", { registration_id: registrationId });
  }
}

class FallbackOpenClawProvider implements OpenClawProvider {
  constructor(
    private readonly primary: OpenClawProvider,
    private readonly fallback: OpenClawProvider
  ) {}

  async create_event(payload: z.infer<typeof createEventPayload>) {
    return this.withFallback(() => this.primary.create_event(payload), () => this.fallback.create_event(payload));
  }

  async register_event(eventId: string) {
    return this.withFallback(() => this.primary.register_event(eventId), () => this.fallback.register_event(eventId));
  }

  async post_comment(eventId: string, content: string) {
    return this.withFallback(
      () => this.primary.post_comment(eventId, content),
      () => this.fallback.post_comment(eventId, content)
    );
  }

  async reply_comment(postId: string, content: string) {
    return this.withFallback(
      () => this.primary.reply_comment(postId, content),
      () => this.fallback.reply_comment(postId, content)
    );
  }

  async like_post(postId: string) {
    return this.withFallback(() => this.primary.like_post(postId), () => this.fallback.like_post(postId));
  }

  async transfer_to_owner(registrationId: string) {
    return this.withFallback(
      () => this.primary.transfer_to_owner(registrationId),
      () => this.fallback.transfer_to_owner(registrationId)
    );
  }

  private async withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>) {
    try {
      return await primary();
    } catch {
      return fallback();
    }
  }
}

function parseBoolean(input: string | undefined, defaultValue: boolean) {
  if (input === undefined || input === "") {
    return defaultValue;
  }
  return input === "true";
}

function parseNumber(input: string | undefined, defaultValue: number, min: number) {
  const parsed = Number(input ?? defaultValue);
  if (!Number.isFinite(parsed) || parsed < min) {
    return defaultValue;
  }
  return parsed;
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, "");
}

function normalizeBasePath(path: string) {
  const trimmed = path.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getOpenClawProviderConfig(options?: OpenClawProviderOptions): ResolvedOpenClawProviderConfig {
  const mode = options?.mode ?? ((process.env.OPENCLAW_PROVIDER_MODE as ProviderMode | undefined) ?? "mock");
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const fallbackDefault = nodeEnv !== "production";

  return {
    mode,
    endpoint: options?.endpoint ?? process.env.OPENCLAW_ENDPOINT,
    token: options?.token ?? process.env.OPENCLAW_TOKEN,
    timeoutMs: options?.timeoutMs ?? parseNumber(process.env.OPENCLAW_TIMEOUT_MS, 8000, 1000),
    maxRetries: options?.maxRetries ?? parseNumber(process.env.OPENCLAW_MAX_RETRIES, 2, 0),
    retryBackoffMs: options?.retryBackoffMs ?? parseNumber(process.env.OPENCLAW_RETRY_BACKOFF_MS, 250, 50),
    fallbackToMockOnError:
      options?.fallbackToMockOnError ?? parseBoolean(process.env.OPENCLAW_FALLBACK_TO_MOCK, fallbackDefault),
    basePath: options?.basePath ?? normalizeBasePath(process.env.OPENCLAW_BASE_PATH ?? "/tools")
  };
}

export function createOpenClawProvider(options?: OpenClawProviderOptions): OpenClawProvider {
  const config = getOpenClawProviderConfig(options);
  const mock = new MockOpenClawProvider();

  if (config.mode !== "real") {
    return mock;
  }

  if (!config.endpoint) {
    return mock;
  }

  const real = new RealOpenClawProvider(
    normalizeEndpoint(config.endpoint),
    config.token,
    config.timeoutMs,
    config.maxRetries,
    config.retryBackoffMs,
    config.basePath,
    options?.fetchImpl ?? fetch
  );

  if (config.fallbackToMockOnError) {
    return new FallbackOpenClawProvider(real, mock);
  }

  return real;
}
