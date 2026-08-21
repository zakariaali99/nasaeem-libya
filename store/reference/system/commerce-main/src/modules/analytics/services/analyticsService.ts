import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/drizzle";
import { analyticsEvents, analyticsIdentities } from "@/lib/db/schema";
import redisClient from "@/modules/cache/redisClient";
import MessageQueue from "@/modules/message_queue";
import { EventPayloadSchema, EventPayloadInput, BufferedEvent, ANALYTICS_BATCH_SIZE, ANALYTICS_BUFFER_TTL_SECONDS, ANALYTICS_FLUSH_INTERVAL_SECONDS, ANALYTICS_LOCK_TTL_SECONDS } from "../types/eventTypes";
import { eq, isNull, or } from "drizzle-orm";

const ANALYTICS_QUEUE_NAME = "analytics-flush";
const ANALYTICS_BUFFER_KEY = "analytics:events";
const ANALYTICS_FLUSH_LOCK_KEY = "analytics:flush:lock";
const ANALYTICS_SCHEDULE_LOCK_KEY = "analytics:flush:schedule";

let workerInitialized = false;

function ensureWorker() {
  if (workerInitialized) return;
  MessageQueue.processQueue(ANALYTICS_QUEUE_NAME, async () => {
    await flushBufferedEvents();
  }, 1);
  workerInitialized = true;
}

async function enqueueFlushJob(trigger: "threshold" | "interval") {
  ensureWorker();
  await MessageQueue.addJob(
    ANALYTICS_QUEUE_NAME,
    "flush",
    { trigger },
    {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    }
  );
}

async function ensureIdentityLink(anonymousId: string, userId?: string | null) {
  const IDENTITY_CACHE_TTL = 3600; // 1 hour
  const cacheKey = `analytics:identity:${anonymousId}:${userId || "anon"}`;

  // Try to set cache key. If it exists, we skip DB update
  const exists = await redisClient.set(cacheKey, "1", "EX", IDENTITY_CACHE_TTL, "NX");
  if (!exists) {
    return; // Already linked/seen recently
  }

  const now = new Date();
  // If no userId, just ensure anonymous record exists and bump lastSeen
  if (!userId) {
    await db
      .insert(analyticsIdentities)
      .values({ anonymousId, lastSeenAt: now })
      .onConflictDoUpdate({
        target: analyticsIdentities.anonymousId,
        set: { lastSeenAt: now },
      });
    return;
  }

  await db
    .insert(analyticsIdentities)
    .values({ anonymousId, userId, linkedAt: now, lastSeenAt: now })
    .onConflictDoUpdate({
      target: analyticsIdentities.anonymousId,
      set: { userId, linkedAt: now, lastSeenAt: now },
      where: or(isNull(analyticsIdentities.userId), eq(analyticsIdentities.userId, userId)),
    });
}

async function bufferEvents(events: BufferedEvent[]) {
  if (events.length === 0) return;
  const pipeline = redisClient.multi();
  const serialized = events.map(e => JSON.stringify(e));
  pipeline.rpush(ANALYTICS_BUFFER_KEY, ...serialized);
  pipeline.expire(ANALYTICS_BUFFER_KEY, ANALYTICS_BUFFER_TTL_SECONDS);
  const execResult = await pipeline.exec();
  const length = Array.isArray(execResult) ? Number(execResult[0]?.[1] ?? 0) : 0;

  // If length is at or above batch size, force a flush
  if (typeof length === "number" && length >= ANALYTICS_BATCH_SIZE) {
    await enqueueFlushJob("threshold");
    return;
  }

  // Otherwise, schedule flush at most once per interval
  const scheduled = await redisClient.set(
    ANALYTICS_SCHEDULE_LOCK_KEY,
    "1",
    "EX",
    ANALYTICS_FLUSH_INTERVAL_SECONDS,
    "NX"
  );
  if (scheduled) {
    await enqueueFlushJob("interval");
  }
}

async function popBatch(max: number): Promise<BufferedEvent[]> {
  const raw = await redisClient.lpop(ANALYTICS_BUFFER_KEY, max);
  if (!raw) return [];
  const rows = Array.isArray(raw) ? raw : [raw];
  const events: BufferedEvent[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row) as BufferedEvent;
      events.push(parsed);
    } catch (err) {
      console.error("Failed to parse buffered analytics event", err);
    }
  }
  return events;
}

export async function ingestEvents(payloads: EventPayloadInput[], sessionUserId?: string | null) {
  if (payloads.length === 0) return [];

  const userId = sessionUserId ?? null;
  const bufferedEvents: BufferedEvent[] = [];
  const results = [];

  for (const payload of payloads) {
    const parsed = EventPayloadSchema.parse(payload);
    const anonymousId = parsed.anonymousId;
    const event: BufferedEvent = {
      id: randomUUID(),
      anonymousId,
      userId,
      sessionId: parsed.sessionId ?? null,
      eventName: parsed.eventName,
      eventType: parsed.eventType ?? "custom",
      properties: parsed.properties ?? {},
      context: parsed.context ?? {},
      occurredAt: parsed.occurredAt ?? new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };
    bufferedEvents.push(event);
    results.push({ eventId: event.id, userId });
  }

  // Ensure identity link for the first anonymousId in the batch
  // since they are usually from the same client session
  const firstAnon = payloads[0]?.anonymousId;
  if (firstAnon) {
    await ensureIdentityLink(firstAnon, userId);
  }

  await bufferEvents(bufferedEvents);
  return results;
}

export async function ingestEvent(payload: EventPayloadInput, sessionUserId?: string | null) {
  const res = await ingestEvents([payload], sessionUserId);
  return res[0];
}

export async function flushBufferedEvents() {
  const lock = await redisClient.set(
    ANALYTICS_FLUSH_LOCK_KEY,
    "1",
    "EX",
    ANALYTICS_LOCK_TTL_SECONDS,
    "NX"
  );
  if (!lock) {
    return;
  }

  try {
    while (true) {
      const batch = await popBatch(ANALYTICS_BATCH_SIZE);
      if (!batch.length) break;

      const rows = batch.map((event) => ({
        id: event.id,
        anonymousId: event.anonymousId,
        userId: event.userId ?? null,
        sessionId: event.sessionId ?? null,
        eventName: event.eventName,
        eventType: event.eventType ?? "custom",
        properties: event.properties ?? {},
        context: event.context ?? null,
        occurredAt: new Date(event.occurredAt),
        receivedAt: new Date(event.receivedAt),
      }));

      await db
        .insert(analyticsEvents)
        .values(rows)
        .onConflictDoNothing();

      // If we processed a full batch, loop again immediately; otherwise break
      if (batch.length < ANALYTICS_BATCH_SIZE) {
        break;
      }
    }
  } catch (error) {
    console.error("Error flushing analytics events:", error);
    throw error;
  } finally {
    await redisClient.del(ANALYTICS_FLUSH_LOCK_KEY);
  }
}

export async function getSessionUserId(req: NextRequest) {
  try {
    const session = await auth.api.getSession(req as any);
    return session?.user?.id ?? null;
  } catch (err) {
    console.warn("تعذر جلب الجلسة أثناء التتبع", err);
    return null;
  }
}
