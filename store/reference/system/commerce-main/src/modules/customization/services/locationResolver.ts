import { db } from '@/lib/db/drizzle';
import { orders, cities } from '@/lib/db/schema';
import { eq, desc, isNotNull } from 'drizzle-orm';
import { headers } from 'next/headers';

/**
 * Resolves the user's city/region using a priority chain:
 * 1. Authenticated user's most recent shipping city (most reliable)
 * 2. IP geolocation → city approximation (fallback for guests)
 *
 * Returns the city NAME (not ID) to match against targeting rules.
 */
export async function resolveUserRegion(userId: string | null): Promise<string | null> {
    // Priority 1: Use the most recent order's shipping city
    if (userId) {
        try {
            const [latestOrder] = await db
                .select({
                    cityId: orders.shippingCityId,
                })
                .from(orders)
                .where(eq(orders.userId, userId))
                .orderBy(desc(orders.createdAt))
                .limit(1);

            if (latestOrder?.cityId) {
                const [city] = await db
                    .select({ name: cities.name })
                    .from(cities)
                    .where(eq(cities.id, latestOrder.cityId))
                    .limit(1);

                if (city) return city.name;
            }
        } catch (err) {
            console.error('Failed to resolve region from order history:', err);
        }
    }

    // Priority 2: IP-based geolocation
    try {
        const headersList = await headers();
        // Common headers set by reverse proxies / CDNs / Vercel
        const cfCity = headersList.get('cf-ipcity');      // Cloudflare
        const vercelCity = headersList.get('x-vercel-ip-city'); // Vercel
        const realCity = headersList.get('x-real-city');   // Custom proxy

        const ipCity = cfCity || vercelCity || realCity;
        if (ipCity) {
            // Try to match against our known cities
            const decoded = decodeURIComponent(ipCity);
            const [matchedCity] = await db
                .select({ name: cities.name })
                .from(cities)
                .where(eq(cities.name, decoded))
                .limit(1);

            if (matchedCity) return matchedCity.name;
        }

        // Fallback: x-forwarded-for → external IP geo lookup
        // (We skip external API calls to avoid latency on every homepage load.
        //  IP headers from the CDN/proxy are the preferred method.)
    } catch (err) {
        console.error('Failed to resolve region from IP:', err);
    }

    return null;
}
