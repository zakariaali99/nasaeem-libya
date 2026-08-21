import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { sql } from "drizzle-orm";
import { getCache, setCache } from "@/modules/cache";

// تخصيص صلاحيات التخزين المؤقت لكل ويدجت/مقياس
const WIDGET_TTLS: Record<string, number> = {
  daily: 300,
  products: 300,
  productConversion: 300,
  search: 300,
  funnels: 180,
  devices: 600,
  geo: 600,
  webVitals: 900,
  cohortsWeekly: 900,
  cohortsMonthly: 900,
  engagement: 300,
  auth: 300,
  payment: 300,
  acquisition: 300,
};

async function withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached) return cached;
  const value = await fn();
  await setCache(key, value, ttlSeconds);
  return value;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rangeDaysRaw = Number(searchParams.get("rangeDays") ?? "30");
  const rangeDays = Number.isFinite(rangeDaysRaw) ? Math.min(Math.max(rangeDaysRaw, 1), 180) : 30;

  const cacheKeyBase = `analytics:overview:${rangeDays}`;

  const [daily, productsTop, productConversion, searchTop, acquisitionSources, acquisitionMediums, acquisitionCampaigns, acquisitionReferrers, funnelCounts, paymentLifecycle, authStats, paymentFailuresByMethod, deviceBreakdown, deviceTypeBreakdown, osBreakdown, browserBreakdown, countryBreakdown, cityBreakdown, countryMetrics, cityMetrics, geoCostByCity, webVitals, webVitalsByDevice, engagementSummary, engagementActions, cohortsWeekly, cohortsMonthly] = await Promise.all([
    withCache(`${cacheKeyBase}:daily`, WIDGET_TTLS.daily, async () => {
      const res = await db.execute(sql`
        WITH days AS (
          SELECT generate_series(current_date - ${rangeDays - 1}::int, current_date, '1 day')::date AS day
        ),
        counts AS (
          SELECT date_trunc('day', occurred_at)::date AS day, event_name, count(*)::int AS c
          FROM analytics_events
          WHERE occurred_at >= current_date - ${rangeDays - 1}::int
          GROUP BY 1,2
        )
        SELECT d.day,
          COALESCE(SUM(CASE WHEN event_name = 'page_view' THEN c END), 0)::int AS page_views,
          COALESCE(SUM(CASE WHEN event_name = 'product_view' THEN c END), 0)::int AS product_views,
          COALESCE(SUM(CASE WHEN event_name = 'search' THEN c END), 0)::int AS searches,
          COALESCE(SUM(CASE WHEN event_name = 'search_no_results' THEN c END), 0)::int AS search_no_results,
          COALESCE(SUM(CASE WHEN event_name = 'payment_verified' THEN c END), 0)::int AS completed_checkout,
          COALESCE(SUM(CASE WHEN event_name = 'checkout_recovery' THEN c END), 0)::int AS checkout_recovery,
          COALESCE(SUM(CASE WHEN event_name = 'add_to_cart' THEN c END), 0)::int AS add_to_cart,
          COALESCE(SUM(CASE WHEN event_name = 'payment_initiated' THEN c END), 0)::int AS payment_initiated,
          COALESCE(SUM(CASE WHEN event_name = 'payment_success' THEN c END), 0)::int AS payment_success,
          COALESCE(SUM(CASE WHEN event_name = 'payment_failed' THEN c END), 0)::int AS payment_failed,
          COALESCE(SUM(CASE WHEN event_name = 'search_select' THEN c END), 0)::int AS search_select
        FROM days d
        LEFT JOIN counts c ON c.day = d.day
        GROUP BY d.day
        ORDER BY d.day;
      `);
      return res.rows.map((r: any) => ({
        day: r.day,
        page_views: Number(r.page_views || 0),
        product_views: Number(r.product_views || 0),
        searches: Number(r.searches || 0),
        search_no_results: Number(r.search_no_results || 0),
        completed_checkout: Number(r.completed_checkout || 0),
        checkout_recovery: Number(r.checkout_recovery || 0),
        add_to_cart: Number(r.add_to_cart || 0),
        payment_initiated: Number(r.payment_initiated || 0),
        payment_success: Number(r.payment_success || 0),
        payment_failed: Number(r.payment_failed || 0),
        search_select: Number(r.search_select || 0),
      }));
    }),
    withCache(`${cacheKeyBase}:products`, WIDGET_TTLS.products, async () => {
      const res = await db.execute(sql`
        SELECT
          properties->>'productId' AS product_id,
          p.name AS name,
          COUNT(*)::int AS views
        FROM analytics_events ae
        LEFT JOIN products p ON p.id::text = properties->>'productId'
        WHERE ae.event_name = 'product_view'
          AND ae.occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY product_id, name
        ORDER BY views DESC
        LIMIT 8;
      `);
      return res.rows.map((r: any) => ({
        product_id: r.product_id,
        name: r.name ?? 'منتج غير معروف',
        views: Number(r.views || 0),
      }));
    }),
    withCache(`${cacheKeyBase}:productConversion`, WIDGET_TTLS.productConversion, async () => {
      const res = await db.execute(sql`
        SELECT
          properties->>'productId' AS product_id,
          p.name AS name,
          SUM(CASE WHEN event_name = 'product_view' THEN 1 ELSE 0 END)::int AS views,
          SUM(CASE WHEN event_name = 'add_to_cart' THEN 1 ELSE 0 END)::int AS add_to_cart,
          SUM(CASE WHEN event_name = 'payment_verified' THEN 1 ELSE 0 END)::int AS payments
        FROM analytics_events ae
        LEFT JOIN products p ON p.id::text = properties->>'productId'
        WHERE ae.event_name IN ('product_view', 'add_to_cart', 'payment_verified')
          AND ae.occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY product_id, name
        ORDER BY views DESC
        LIMIT 12;
      `);
      return res.rows.map((r: any) => ({
        product_id: r.product_id,
        name: r.name ?? 'منتج غير معروف',
        views: Number(r.views || 0),
        add_to_cart: Number(r.add_to_cart || 0),
        payments: Number(r.payments || 0),
      }));
    }),
    withCache(`${cacheKeyBase}:search`, WIDGET_TTLS.search, async () => {
      const res = await db.execute(sql`
        SELECT
          properties->>'query' AS query,
          SUM(CASE WHEN event_name = 'search' THEN 1 ELSE 0 END)::int AS count,
          SUM(CASE WHEN event_name = 'search_select' THEN 1 ELSE 0 END)::int AS select_count
        FROM analytics_events
        WHERE event_name IN ('search', 'search_select')
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY query
        ORDER BY count DESC
        LIMIT 12;
      `);
      return res.rows.map((r: any) => ({
        query: r.query ?? 'غير معروف',
        count: Number(r.count || 0),
        select_count: Number(r.select_count || 0),
      }));
    }),
    withCache(`${cacheKeyBase}:acq:sources`, WIDGET_TTLS.acquisition, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(properties->>'utm_source', 'غير محدد') AS source,
          COALESCE(properties->>'utm_medium', 'غير محدد') AS medium,
          COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name = 'campaign'
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY source, medium
        ORDER BY count DESC
        LIMIT 12;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:acq:mediums`, WIDGET_TTLS.acquisition, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(properties->>'utm_medium', 'غير محدد') AS medium,
          COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name = 'campaign'
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY medium
        ORDER BY count DESC
        LIMIT 10;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:acq:campaigns`, WIDGET_TTLS.acquisition, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(properties->>'utm_campaign', 'غير محدد') AS campaign,
          COALESCE(properties->>'utm_source', 'غير محدد') AS source,
          COALESCE(properties->>'utm_medium', 'غير محدد') AS medium,
          COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name = 'campaign'
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY campaign, source, medium
        ORDER BY count DESC
        LIMIT 12;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:acq:referrers`, WIDGET_TTLS.acquisition, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(properties->>'referrer', ''), 'غير محدد') AS referrer,
          COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name = 'campaign'
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 10;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:funnel`, WIDGET_TTLS.funnels, async () => {
      const res = await db.execute(sql`
        SELECT
          SUM(CASE WHEN event_name = 'add_to_cart' THEN 1 ELSE 0 END)::int AS add_to_cart,
          SUM(CASE WHEN event_name = 'checkout_recovery' THEN 1 ELSE 0 END)::int AS checkout_attempts,
          SUM(CASE WHEN event_name = 'payment_initiated' THEN 1 ELSE 0 END)::int AS payment_initiated,
          SUM(CASE WHEN event_name = 'payment_success' THEN 1 ELSE 0 END)::int AS payment_success,
          SUM(CASE WHEN event_name = 'payment_failed' THEN 1 ELSE 0 END)::int AS payment_failed,
          SUM(CASE WHEN event_name = 'payment_verified' THEN 1 ELSE 0 END)::int AS payments_completed
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval;
      `);
      return res.rows?.[0] || {};
    }),
    withCache(`${cacheKeyBase}:paymentLifecycle`, WIDGET_TTLS.payment, async () => {
      const res = await db.execute(sql`
        SELECT event_name, COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name IN ('payment_initiated', 'payment_redirect', 'payment_success', 'payment_failed', 'payment_verified')
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY event_name;
      `);
      return res.rows as { event_name: string; count: number }[];
    }),
    withCache(`${cacheKeyBase}:auth`, WIDGET_TTLS.auth, async () => {
      const res = await db.execute(sql`
        SELECT
          SUM(CASE WHEN event_name = 'login_success' THEN 1 ELSE 0 END)::int AS login_success,
          SUM(CASE WHEN event_name = 'login_failed' THEN 1 ELSE 0 END)::int AS login_failed,
          SUM(CASE WHEN event_name = 'signup_success' THEN 1 ELSE 0 END)::int AS signup_success,
          SUM(CASE WHEN event_name = 'signup_failed' THEN 1 ELSE 0 END)::int AS signup_failed
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval;
      `);
      return res.rows?.[0] || {};
    }),
    withCache(`${cacheKeyBase}:paymentFailuresByMethod`, WIDGET_TTLS.payment, async () => {
      const res = await db.execute(sql`
        SELECT
          payment_method,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int AS failed,
          SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END)::int AS succeeded,
          SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END)::int AS verified
        FROM payments
        WHERE created_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY payment_method
        ORDER BY failed DESC;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:device`, WIDGET_TTLS.devices, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(properties->>'device_name', properties->>'device_type', 'غير محدد') AS device,
          COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name IN ('page_view', 'product_view', 'search')
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY device
        ORDER BY count DESC;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:deviceTypes`, WIDGET_TTLS.devices, async () => {
      const res = await db.execute(sql`
        SELECT COALESCE(properties->>'device_type', 'غير محدد') AS device_type, COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name IN ('page_view', 'product_view', 'search')
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY device_type
        ORDER BY count DESC;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:oses`, WIDGET_TTLS.devices, async () => {
      const res = await db.execute(sql`
        SELECT COALESCE(properties->>'os', 'غير محدد') AS os, COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name IN ('page_view', 'product_view', 'search')
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY os
        ORDER BY count DESC;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:browsers`, WIDGET_TTLS.devices, async () => {
      const res = await db.execute(sql`
        SELECT COALESCE(properties->>'browser', 'غير محدد') AS browser, COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name IN ('page_view', 'product_view', 'search')
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY browser
        ORDER BY count DESC;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:countries`, WIDGET_TTLS.geo, async () => {
      const res = await db.execute(sql`
        SELECT COALESCE(properties->>'country', 'غير محدد') AS country, COUNT(*)::int AS count
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY country
        ORDER BY count DESC
        LIMIT 20;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:cities`, WIDGET_TTLS.geo, async () => {
      const res = await db.execute(sql`
        SELECT COALESCE(properties->>'city', 'غير محدد') AS city, COUNT(*)::int AS count
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY city
        ORDER BY count DESC
        LIMIT 20;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:countryMetrics`, WIDGET_TTLS.geo, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(properties->>'country', 'غير محدد') AS country,
          SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END)::int AS page_views,
          SUM(CASE WHEN event_name = 'product_view' THEN 1 ELSE 0 END)::int AS product_views,
          SUM(CASE WHEN event_name = 'search' THEN 1 ELSE 0 END)::int AS searches,
          SUM(CASE WHEN event_name = 'payment_verified' THEN 1 ELSE 0 END)::int AS payments_completed
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY country
        ORDER BY payments_completed DESC, page_views DESC
        LIMIT 30;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:cityMetrics`, WIDGET_TTLS.geo, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(properties->>'city', 'غير محدد') AS city,
          COALESCE(properties->>'country', 'غير محدد') AS country,
          SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END)::int AS page_views,
          SUM(CASE WHEN event_name = 'product_view' THEN 1 ELSE 0 END)::int AS product_views,
          SUM(CASE WHEN event_name = 'search' THEN 1 ELSE 0 END)::int AS searches,
          SUM(CASE WHEN event_name = 'payment_verified' THEN 1 ELSE 0 END)::int AS payments_completed
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY city, country
        ORDER BY payments_completed DESC, page_views DESC
        LIMIT 30;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:geoCostByCity`, WIDGET_TTLS.geo, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(c.name, 'غير محدد') AS city,
          COALESCE(r.name, 'غير محدد') AS region,
          COUNT(*)::int AS orders,
          SUM(o.total)::numeric AS order_total,
          SUM(o.shipping_total)::numeric AS shipping_total,
          SUM(o.discount_total)::numeric AS discount_total,
          SUM(o.delivery_discount_amount)::numeric AS delivery_discount_amount
        FROM orders o
        LEFT JOIN cities c ON c.id = o.shipping_city_id
        LEFT JOIN regions r ON r.id = o.shipping_region_id
        WHERE o.created_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY city, region
        ORDER BY order_total DESC
        LIMIT 30;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:webVitals`, WIDGET_TTLS.webVitals, async () => {
      const res = await db.execute(sql`
        SELECT
          AVG((properties->>'cls')::float) AS cls,
          AVG((properties->>'lcp')::float) AS lcp,
          AVG((properties->>'fid')::float) AS fid,
          AVG((properties->>'inp')::float) AS inp
        FROM analytics_events
        WHERE event_name = 'web_vitals'
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval;
      `);
      return {
        cls: Number(res.rows?.[0]?.cls || 0),
        lcp: Number(res.rows?.[0]?.lcp || 0),
        fid: Number(res.rows?.[0]?.fid || 0),
        inp: Number(res.rows?.[0]?.inp || 0),
      };
    }),
    withCache(`${cacheKeyBase}:webVitalsByDevice`, WIDGET_TTLS.webVitals, async () => {
      const res = await db.execute(sql`
        SELECT
          COALESCE(properties->>'device_type', 'غير محدد') AS device_type,
          COUNT(*)::int AS samples,
          AVG((properties->>'cls')::float) AS cls,
          AVG((properties->>'lcp')::float) AS lcp,
          AVG((properties->>'fid')::float) AS fid,
          AVG((properties->>'inp')::float) AS inp
        FROM analytics_events
        WHERE event_name = 'web_vitals'
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY device_type
        ORDER BY samples DESC;
      `);
      return res.rows as any[];
    }),
    withCache(`${cacheKeyBase}:engagementSummary`, WIDGET_TTLS.engagement, async () => {
      const res = await db.execute(sql`
        SELECT
          AVG((properties->>'depth')::float) AS avg_scroll_depth,
          SUM(CASE WHEN event_name = 'product_engagement' THEN 1 ELSE 0 END)::int AS product_engagement_events,
          SUM(CASE WHEN event_name = 'filter_sort_usage' THEN 1 ELSE 0 END)::int AS filter_sort_events
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval;
      `);
      return {
        avg_scroll_depth: Number(res.rows?.[0]?.avg_scroll_depth || 0),
        product_engagement_events: Number(res.rows?.[0]?.product_engagement_events || 0),
        filter_sort_events: Number(res.rows?.[0]?.filter_sort_events || 0),
      };
    }),
    withCache(`${cacheKeyBase}:engagementActions`, WIDGET_TTLS.engagement, async () => {
      const res = await db.execute(sql`
        SELECT properties->>'action' AS action, COUNT(*)::int AS count
        FROM analytics_events
        WHERE event_name = 'product_engagement'
          AND occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY action
        ORDER BY count DESC
        LIMIT 12;
      `);
      return res.rows as { action: string | null; count: number }[];
    }),
    withCache(`${cacheKeyBase}:cohortsWeekly`, WIDGET_TTLS.cohortsWeekly, async () => {
      const res = await db.execute(sql`
        SELECT
          to_char(date_trunc('week', occurred_at), 'YYYY-IW') AS period,
          MIN(date_trunc('week', occurred_at))::date AS bucket_start,
          SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END)::int AS page_views,
          SUM(CASE WHEN event_name = 'product_view' THEN 1 ELSE 0 END)::int AS product_views,
          SUM(CASE WHEN event_name = 'checkout_recovery' THEN 1 ELSE 0 END)::int AS checkout_attempts,
          SUM(CASE WHEN event_name = 'payment_verified' THEN 1 ELSE 0 END)::int AS payments_completed
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY 1
        ORDER BY bucket_start;
      `);
      return res.rows.map((r: any) => ({
        period: r.period,
        page_views: Number(r.page_views || 0),
        product_views: Number(r.product_views || 0),
        checkout_attempts: Number(r.checkout_attempts || 0),
        payments_completed: Number(r.payments_completed || 0),
      }));
    }),
    withCache(`${cacheKeyBase}:cohortsMonthly`, WIDGET_TTLS.cohortsMonthly, async () => {
      const res = await db.execute(sql`
        SELECT
          to_char(date_trunc('month', occurred_at), 'YYYY-MM') AS period,
          MIN(date_trunc('month', occurred_at))::date AS bucket_start,
          SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END)::int AS page_views,
          SUM(CASE WHEN event_name = 'product_view' THEN 1 ELSE 0 END)::int AS product_views,
          SUM(CASE WHEN event_name = 'checkout_recovery' THEN 1 ELSE 0 END)::int AS checkout_attempts,
          SUM(CASE WHEN event_name = 'payment_verified' THEN 1 ELSE 0 END)::int AS payments_completed
        FROM analytics_events
        WHERE occurred_at >= now() - (${rangeDays} || ' days')::interval
        GROUP BY 1
        ORDER BY bucket_start;
      `);
      return res.rows.map((r: any) => ({
        period: r.period,
        page_views: Number(r.page_views || 0),
        product_views: Number(r.product_views || 0),
        checkout_attempts: Number(r.checkout_attempts || 0),
        payments_completed: Number(r.payments_completed || 0),
      }));
    }),
  ]);

  const summary = daily.reduce(
    (acc: {
      pageViews: number;
      productViews: number;
      searches: number;
      searchNoResults: number;
      completedCheckout: number;
      checkoutRecovery: number;
    }, row: any) => {
      acc.pageViews += Number(row.page_views || 0);
      acc.productViews += Number(row.product_views || 0);
      acc.searches += Number(row.searches || 0);
      acc.searchNoResults += Number(row.search_no_results || 0);
      acc.completedCheckout += Number(row.completed_checkout || 0);
      acc.checkoutRecovery += Number(row.checkout_recovery || 0);
      return acc;
    },
    { pageViews: 0, productViews: 0, searches: 0, searchNoResults: 0, completedCheckout: 0, checkoutRecovery: 0 }
  );

  const funnel = [
    { step: 'إضافة للسلة', value: Number((funnelCounts as any).add_to_cart || 0) },
    { step: 'محاولات الدفع', value: Number((funnelCounts as any).checkout_attempts || 0) },
    { step: 'بدء الدفع', value: Number((funnelCounts as any).payment_initiated || 0) },
    { step: 'نجاح بوابة الدفع', value: Number((funnelCounts as any).payment_success || 0) },
    { step: 'فشل الدفع', value: Number((funnelCounts as any).payment_failed || 0) },
    { step: 'تم الدفع', value: Number((funnelCounts as any).payments_completed || 0) },
  ];

  const paymentLifecycleSeries = [
    { step: 'بدأ الدفع', value: Number(paymentLifecycle.find((r) => r.event_name === 'payment_initiated')?.count || 0) },
    { step: 'تحويل للبوابة', value: Number(paymentLifecycle.find((r) => r.event_name === 'payment_redirect')?.count || 0) },
    { step: 'نجاح البوابة', value: Number(paymentLifecycle.find((r) => r.event_name === 'payment_success')?.count || 0) },
    { step: 'فشل الدفع', value: Number(paymentLifecycle.find((r) => r.event_name === 'payment_failed')?.count || 0) },
    { step: 'موثق', value: Number(paymentLifecycle.find((r) => r.event_name === 'payment_verified')?.count || 0) },
  ];

  const payload = {
    rangeDays,
    daily,
    products: productsTop,
    productConversion,
    search: {
      topQueries: searchTop,
      noResultsRate: summary.searches ? summary.searchNoResults / summary.searches : 0,
      selectRate: summary.searches ? daily.reduce((acc, r: any) => acc + Number(r.search_select || 0), 0) / summary.searches : 0,
    },
    funnel,
    paymentLifecycle: paymentLifecycleSeries,
    auth: {
      login_success: Number((authStats as any)?.login_success || 0),
      login_failed: Number((authStats as any)?.login_failed || 0),
      signup_success: Number((authStats as any)?.signup_success || 0),
      signup_failed: Number((authStats as any)?.signup_failed || 0),
    },
    devices: deviceBreakdown.map((r: any) => ({
      device: r.device,
      count: Number(r.count || 0),
    })),
    deviceTypes: deviceTypeBreakdown.map((r: any) => ({
      device_type: r.device_type,
      count: Number(r.count || 0),
    })),
    oses: osBreakdown.map((r: any) => ({
      os: r.os,
      count: Number(r.count || 0),
    })),
    browsers: browserBreakdown.map((r: any) => ({
      browser: r.browser,
      count: Number(r.count || 0),
    })),
    countries: countryBreakdown.map((r: any) => ({
      country: r.country,
      count: Number(r.count || 0),
    })),
    cities: cityBreakdown.map((r: any) => ({
      city: r.city,
      count: Number(r.count || 0),
    })),
    countryMetrics: countryMetrics.map((r: any) => ({
      country: r.country,
      page_views: Number(r.page_views || 0),
      product_views: Number(r.product_views || 0),
      searches: Number(r.searches || 0),
      payments_completed: Number(r.payments_completed || 0),
    })),
    cityMetrics: cityMetrics.map((r: any) => ({
      city: r.city,
      country: r.country,
      page_views: Number(r.page_views || 0),
      product_views: Number(r.product_views || 0),
      searches: Number(r.searches || 0),
      payments_completed: Number(r.payments_completed || 0),
    })),
    webVitals,
    engagement: {
      avg_scroll_depth: engagementSummary.avg_scroll_depth,
      product_engagement_events: engagementSummary.product_engagement_events,
      filter_sort_events: engagementSummary.filter_sort_events,
      actions: engagementActions.map((r) => ({ action: r.action ?? 'غير محدد', count: Number(r.count || 0) })),
    },
    paymentFailuresByMethod: (paymentFailuresByMethod as any[]).map((r) => ({
      payment_method: r.payment_method ?? 'غير محدد',
      failed: Number(r.failed || 0),
      succeeded: Number(r.succeeded || 0),
      verified: Number(r.verified || 0),
    })),
    webVitalsByDevice: (webVitalsByDevice as any[]).map((r) => ({
      device_type: r.device_type ?? 'غير محدد',
      samples: Number(r.samples || 0),
      cls: Number(r.cls || 0),
      lcp: Number(r.lcp || 0),
      fid: Number(r.fid || 0),
      inp: Number(r.inp || 0),
    })),
    geoCostByCity: (geoCostByCity as any[]).map((r) => ({
      city: r.city ?? 'غير محدد',
      region: r.region ?? 'غير محدد',
      orders: Number(r.orders || 0),
      order_total: Number(r.order_total || 0),
      shipping_total: Number(r.shipping_total || 0),
      discount_total: Number(r.discount_total || 0),
      delivery_discount_amount: Number(r.delivery_discount_amount || 0),
    })),
    cohorts: {
      weekly: cohortsWeekly,
      monthly: cohortsMonthly,
    },
    acquisitions: {
      sources: acquisitionSources.map((r: any) => ({
        source: r.source,
        medium: r.medium,
        count: Number(r.count || 0),
      })),
      mediums: acquisitionMediums.map((r: any) => ({
        medium: r.medium,
        count: Number(r.count || 0),
      })),
      campaigns: acquisitionCampaigns.map((r: any) => ({
        campaign: r.campaign,
        source: r.source,
        medium: r.medium,
        count: Number(r.count || 0),
      })),
      referrers: acquisitionReferrers.map((r: any) => ({
        referrer: r.referrer,
        count: Number(r.count || 0),
      })),
    },
    summary,
  };

  return NextResponse.json(payload, { headers: { "x-cache": "mixed" } });
}
