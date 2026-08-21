import { db } from '@/lib/db/drizzle';
import { analyticsEvents, orders, orderItems, products, productImages } from '@/lib/db/schema';
import { sql, eq, and, desc, inArray } from 'drizzle-orm';

// ── Shared helpers ──────────────────────────────────────────

interface MinimalProduct {
  id: string;
  name: string;
  slug: string;
  price: string | null;
  compareAtPrice?: string | null;
  imageUrl?: string;
  isActive: boolean;
}

async function hydrateProducts(productIds: string[]): Promise<MinimalProduct[]> {
  if (productIds.length === 0) return [];

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      isActive: products.isActive,
    })
    .from(products)
    .where(and(inArray(products.id, productIds), eq(products.isActive, true)));

  // Fetch primary image for each product
  const imageRows = productIds.length > 0
    ? await db
      .select({
        productId: productImages.productId,
        url: productImages.url,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(productImages.sortOrder)
    : [];

  const imageMap = new Map<string, string>();
  for (const img of imageRows) {
    if (!imageMap.has(img.productId)) {
      imageMap.set(img.productId, img.url);
    }
  }

  // Preserve the original order of productIds
  const productMap = new Map(rows.map(r => [r.id, r]));
  const result: MinimalProduct[] = [];
  for (const id of productIds) {
    const p = productMap.get(id);
    if (!p) continue;
    result.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      imageUrl: imageMap.get(p.id),
      isActive: p.isActive,
    });
  }
  return result;
}

// ── Recently Viewed ─────────────────────────────────────────

/**
 * Fetches products the user recently viewed, deduplicated and ordered by recency.
 * Works for both logged-in users (userId) and guests (anonymousId).
 */
export async function fetchRecentlyViewed(
  userId: string | null,
  anonymousId: string | null,
  limit: number = 8,
): Promise<MinimalProduct[]> {
  if (!userId && !anonymousId) return [];

  const identityFilter = userId
    ? sql`user_id = ${userId}`
    : sql`anonymous_id = ${anonymousId}`;

  const result = await db.execute(sql`
    SELECT DISTINCT ON (properties->>'productId')
      properties->>'productId' AS product_id,
      MAX(occurred_at) AS last_viewed
    FROM analytics_events
    WHERE event_name = 'product_view'
      AND (properties::jsonb) ? 'productId'
      AND ${identityFilter}
      AND occurred_at >= now() - interval '30 days'
    GROUP BY properties->>'productId'
    ORDER BY properties->>'productId', last_viewed DESC
    LIMIT ${limit}
  `);

  // Re-sort by recency (DISTINCT ON requires ordering by the distinct column first)
  const sorted = (result.rows as any[])
    .sort((a, b) => new Date(b.last_viewed).getTime() - new Date(a.last_viewed).getTime());

  const productIds = sorted
    .map((r: any) => r.product_id as string)
    .filter(Boolean);

  return hydrateProducts(productIds);
}

// ── Buy Again ───────────────────────────────────────────────

/**
 * Fetches products the user has previously purchased, ordered by purchase frequency.
 * Only works for logged-in users.
 */
export async function fetchBuyAgain(
  userId: string | null,
  limit: number = 8,
): Promise<MinimalProduct[]> {
  if (!userId) return [];

  const result = await db.execute(sql`
    SELECT
      oi.product_id,
      COUNT(*)::int AS purchase_count,
      MAX(o.created_at) AS last_purchased
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.user_id = ${userId}
      AND o.status NOT IN ('cancelled', 'void', 'failed')
    GROUP BY oi.product_id
    ORDER BY purchase_count DESC, last_purchased DESC
    LIMIT ${limit}
  `);

  const productIds = (result.rows as any[])
    .map((r: any) => r.product_id as string)
    .filter(Boolean);

  return hydrateProducts(productIds);
}

// ── Recommended For You ─────────────────────────────────────

/**
 * Generates personalized recommendations based on the user's browsing and purchase history.
 * Uses co-viewing affinity: finds products that other users also viewed/bought alongside
 * the current user's viewed products.
 */
export async function fetchRecommendedForYou(
  userId: string | null,
  anonymousId: string | null,
  limit: number = 8,
): Promise<MinimalProduct[]> {
  if (!userId && !anonymousId) return [];

  const identityFilter = userId
    ? sql`user_id = ${userId}`
    : sql`anonymous_id = ${anonymousId}`;

  // Step 1: Get user's recently viewed product IDs (seed set)
  const seedResult = await db.execute(sql`
    SELECT DISTINCT properties->>'productId' AS product_id
    FROM analytics_events
    WHERE event_name = 'product_view'
      AND (properties::jsonb) ? 'productId'
      AND ${identityFilter}
      AND occurred_at >= now() - interval '30 days'
    ORDER BY product_id
    LIMIT 15
  `);

  const seedIds = (seedResult.rows as any[])
    .map((r: any) => r.product_id as string)
    .filter(Boolean);

  if (seedIds.length === 0) {
    // Fallback: return popular products across the platform
    return fetchPopularProducts(limit);
  }

  // Step 2: Co-viewing affinity — find products viewed by users who also viewed seed products
  const seedArray = sql`ARRAY[${sql.join(seedIds.map(id => sql`${id}`), sql`, `)}]::text[]`;

  const affinityResult = await db.execute(sql`
    SELECT
      properties->>'productId' AS product_id,
      COUNT(DISTINCT COALESCE(user_id, anonymous_id))::int AS co_viewers
    FROM analytics_events
    WHERE event_name IN ('product_view', 'add_to_cart')
      AND (properties::jsonb) ? 'productId'
      AND properties->>'productId' <> ALL(${seedArray})
      AND occurred_at >= now() - interval '30 days'
      AND (user_id IN (
        SELECT DISTINCT user_id FROM analytics_events
        WHERE event_name = 'product_view'
          AND properties->>'productId' = ANY(${seedArray})
          AND user_id IS NOT NULL
          AND occurred_at >= now() - interval '30 days'
      ) OR anonymous_id IN (
        SELECT DISTINCT anonymous_id FROM analytics_events
        WHERE event_name = 'product_view'
          AND properties->>'productId' = ANY(${seedArray})
          AND occurred_at >= now() - interval '30 days'
      ))
    GROUP BY properties->>'productId'
    ORDER BY co_viewers DESC
    LIMIT ${limit}
  `);

  const productIds = (affinityResult.rows as any[])
    .map((r: any) => r.product_id as string)
    .filter(Boolean);

  if (productIds.length === 0) {
    return fetchPopularProducts(limit);
  }

  return hydrateProducts(productIds);
}

// ── Popular Products (fallback) ─────────────────────────────

async function fetchPopularProducts(limit: number): Promise<MinimalProduct[]> {
  const result = await db.execute(sql`
    SELECT
      properties->>'productId' AS product_id,
      COUNT(*)::int AS view_count
    FROM analytics_events
    WHERE event_name = 'product_view'
      AND (properties::jsonb) ? 'productId'
      AND occurred_at >= now() - interval '14 days'
    GROUP BY properties->>'productId'
    ORDER BY view_count DESC
    LIMIT ${limit}
  `);

  const productIds = (result.rows as any[])
    .map((r: any) => r.product_id as string)
    .filter(Boolean);

  return hydrateProducts(productIds);
}

// ── Trending Near You ───────────────────────────────────────

/**
 * Fetches products that are trending in a specific city/region.
 * Uses order data: products most purchased by customers in the same shipping city.
 * Falls back to global popular products if insufficient data.
 */
export async function fetchTrendingNearYou(
  cityName: string | null,
  limit: number = 8,
): Promise<{ products: MinimalProduct[]; cityName: string | null }> {
  if (!cityName) {
    const products = await fetchPopularProducts(limit);
    return { products, cityName: null };
  }

  try {
    // Find the cityId for this city name
    const cityResult = await db.execute(sql`
      SELECT id FROM cities WHERE name = ${cityName} LIMIT 1
    `);

    const cityId = (cityResult.rows as any[])?.[0]?.id;
    if (!cityId) {
      const products = await fetchPopularProducts(limit);
      return { products, cityName };
    }

    // Get trending products in this city by order frequency
    const result = await db.execute(sql`
      SELECT
        oi.product_id,
        COUNT(*)::int AS purchase_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.shipping_city_id = ${cityId}
        AND o.status NOT IN ('cancelled', 'void', 'failed')
        AND o.created_at >= now() - interval '14 days'
      GROUP BY oi.product_id
      ORDER BY purchase_count DESC
      LIMIT ${limit}
    `);

    const productIds = (result.rows as any[])
      .map((r: any) => r.product_id as string)
      .filter(Boolean);

    if (productIds.length < 3) {
      // Not enough regional data, fall back to global popular
      const products = await fetchPopularProducts(limit);
      return { products, cityName };
    }

    const products = await hydrateProducts(productIds);
    return { products, cityName };
  } catch (err) {
    console.error('Failed to fetch trending near you:', err);
    const products = await fetchPopularProducts(limit);
    return { products, cityName };
  }
}
