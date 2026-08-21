import { sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { analyticsRfmScores } from "@/lib/db/schema";
import { RfmMetrics, RfmScore } from "../types";

const EXCLUDED_ORDER_STATUSES = ["cancelled", "void", "failed"];

export async function fetchUserIdsForWindow(windowDays: number, limit: number, offset: number): Promise<string[]> {
  const res = await db.execute(sql`
    SELECT DISTINCT user_id
    FROM orders
    WHERE user_id IS NOT NULL
      AND created_at >= now() - (${windowDays} || ' days')::interval
    ORDER BY user_id
    LIMIT ${limit}
    OFFSET ${offset};
  `);
  return res.rows.map((r: any) => r.user_id as string);
}

export async function loadUserMetrics(userId: string, windowDays: number): Promise<RfmMetrics> {
  const res = await db.execute(sql`
    SELECT
      COUNT(*)::int AS order_count,
      COALESCE(SUM(total), 0)::numeric AS total_spent,
      MAX(created_at) AS last_order_at
    FROM orders
    WHERE user_id = ${userId}
      AND status <> ALL(ARRAY[${sql.join(EXCLUDED_ORDER_STATUSES.map((s) => sql`${s}`), sql`, `)}])
      AND created_at >= now() - (${windowDays} || ' days')::interval;
  `);

  const row = res.rows?.[0] as any;
  const orderCount = Number(row?.order_count ?? 0);
  const totalSpent = Number(row?.total_spent ?? 0);
  const lastOrderAt = row?.last_order_at ? new Date(row.last_order_at) : null;
  const recencyDays = lastOrderAt ? Math.floor((Date.now() - lastOrderAt.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return {
    userId,
    windowLabel: windowDays === 30 ? "30d" : "90d",
    recencyDays,
    orderCount,
    totalSpent,
    lastOrderAt,
  };
}

export async function saveRfmScore(score: RfmScore) {
  await db
    .insert(analyticsRfmScores)
    .values({
      userId: score.userId,
      configId: score.configId,
      windowLabel: score.windowLabel,
      recencyScore: score.recencyScore,
      frequencyScore: score.frequencyScore,
      monetaryScore: score.monetaryScore,
      totalScore: score.totalScore,
      segment: score.segment,
      orderCount: score.metrics.orderCount,
      totalSpent: score.metrics.totalSpent.toString(),
      lastOrderAt: score.metrics.lastOrderAt,
      recencyDays: score.metrics.recencyDays ?? null,
      metrics: score.metrics,
      dimensions: score.dimensions ?? null,
      computedAt: score.computedAt,
      staleAfter: score.staleAfter ?? null,
    })
    .onConflictDoUpdate({
      target: [analyticsRfmScores.userId, analyticsRfmScores.windowLabel, analyticsRfmScores.configId],
      set: {
        recencyScore: score.recencyScore,
        frequencyScore: score.frequencyScore,
        monetaryScore: score.monetaryScore,
        totalScore: score.totalScore,
        segment: score.segment,
        orderCount: score.metrics.orderCount,
        totalSpent: score.metrics.totalSpent.toString(),
        lastOrderAt: score.metrics.lastOrderAt,
        recencyDays: score.metrics.recencyDays ?? null,
        metrics: score.metrics,
        dimensions: score.dimensions ?? null,
        computedAt: score.computedAt,
        staleAfter: score.staleAfter ?? null,
      },
    });
}

export async function countUsersWithOrders(windowDays: number): Promise<number> {
  const res = await db.execute(sql`
    SELECT COUNT(DISTINCT user_id)::int AS count
    FROM orders
    WHERE user_id IS NOT NULL
      AND created_at >= now() - (${windowDays} || ' days')::interval;
  `);
  return Number(res.rows?.[0]?.count ?? 0);
}
