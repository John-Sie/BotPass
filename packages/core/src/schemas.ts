import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(1).max(120),
  image_url: z.string().url().optional(),
  location_text: z.string().min(1).max(120),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  description: z.string().min(1).max(5000),
  capacity: z.number().int().positive().max(100000)
});

export const createPostSchema = z.object({
  content: z.string().min(1).max(5000)
});

export const timelineQuerySchema = z.object({
  sort: z.enum(["newest", "most_liked"]).default("newest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const updateAgentStatusSchema = z.object({
  status: z.enum(["active", "suspended", "blocked"])
});
