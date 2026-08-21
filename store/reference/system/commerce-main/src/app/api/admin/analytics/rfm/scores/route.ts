import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/drizzle";
import { analyticsRfmScores } from "@/lib/db/schema";
import { sql, desc } from "drizzle-orm";
import { getActiveConfig } from "@/modules/analytics/rfm/services/rfmConfigService";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession(req);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(Number(searchParams.get("limit") ?? "80"), 200);
  const windowLabel = searchParams.get("window") ?? undefined;

  const config = await getActiveConfig().catch(() => null);
  const configId = config?.id;

  const whereWindow = windowLabel ? sql`AND s.window_label = ${windowLabel}` : sql``;
  const whereConfig = configId ? sql`AND s.config_id = ${configId}` : sql``;

  const rows = await db.execute(sql`
    SELECT
      s.user_id,
      s.window_label,
      s.segment,
      s.total_score,
      s.recency_score,
      s.frequency_score,
      s.monetary_score,
      s.order_count,
      s.total_spent,
      s.last_order_at,
      s.recency_days,
      s.computed_at,
      u.phone_number AS phone,
      u.email AS email
    FROM analytics_rfm_scores s
    LEFT JOIN "user" u ON u.id = s.user_id
    WHERE 1=1
      ${whereWindow}
      ${whereConfig}
    ORDER BY s.computed_at DESC
    LIMIT ${limit};
  `);

  const segments = await db.execute(sql`
    SELECT segment, COUNT(*)::int AS count
    FROM analytics_rfm_scores
    ${configId ? sql`WHERE config_id = ${configId}` : sql``}
    GROUP BY segment
    ORDER BY count DESC
    LIMIT 20;
  `);

  return NextResponse.json({
    configId,
    window: windowLabel,
    scores: rows.rows,
    segments: segments.rows,
  });
}
