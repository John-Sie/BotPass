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
  constructor(private readonly endpoint: string, private readonly token?: string) {}

  private async call(path: string, body: unknown) {
    const response = await fetch(`${this.endpoint}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`OpenCLAW provider error: ${response.status}`);
    }

    return response.json();
  }

  async create_event(payload: z.infer<typeof createEventPayload>) {
    return this.call("/tools/create_event", payload);
  }

  async register_event(eventId: string) {
    return this.call("/tools/register_event", { event_id: eventId });
  }

  async post_comment(eventId: string, content: string) {
    return this.call("/tools/post_comment", { event_id: eventId, content });
  }

  async reply_comment(postId: string, content: string) {
    return this.call("/tools/reply_comment", { post_id: postId, content });
  }

  async like_post(postId: string) {
    return this.call("/tools/like_post", { post_id: postId });
  }

  async transfer_to_owner(registrationId: string) {
    return this.call("/tools/transfer_to_owner", { registration_id: registrationId });
  }
}

export function createOpenClawProvider(): OpenClawProvider {
  const mode = process.env.OPENCLAW_PROVIDER_MODE ?? "mock";

  if (mode === "real") {
    const endpoint = process.env.OPENCLAW_ENDPOINT;
    if (!endpoint) {
      return new MockOpenClawProvider();
    }

    return new RealOpenClawProvider(endpoint, process.env.OPENCLAW_TOKEN);
  }

  return new MockOpenClawProvider();
}
