import { z } from "zod";

// Defaults for batching and buffering
export const ANALYTICS_BATCH_SIZE = 1000; // large batches, less frequent flushes
export const ANALYTICS_FLUSH_INTERVAL_SECONDS = 60;
export const ANALYTICS_BUFFER_TTL_SECONDS = 60 * 60 * 24; // 24h
export const ANALYTICS_LOCK_TTL_SECONDS = 30; // lock ttl for dedupe/retry

export const AnalyticsContextSchema = z.object({
  url: z.string().url().optional(),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
  locale: z.string().optional(),
  ip: z.string().optional(),
}).passthrough();

export const EventPayloadSchema = z.object({
  anonymousId: z.string().min(10, "anonymousId مطلوب"),
  sessionId: z.string().optional(),
  eventName: z.string().min(1, "الحدث مطلوب"),
  eventType: z.string().optional().default("custom"),
  properties: z.record(z.any()).optional().default({}),
  context: AnalyticsContextSchema.optional().default({}),
  occurredAt: z.string().datetime().optional(),
});

export type EventPayloadInput = z.infer<typeof EventPayloadSchema>;

export type BufferedEvent = {
  id: string;
  anonymousId: string;
  userId?: string | null;
  sessionId?: string | null;
  eventName: string;
  eventType?: string | null;
  properties: Record<string, any>;
  context?: Record<string, any> | null;
  occurredAt: string;
  receivedAt: string;
};
