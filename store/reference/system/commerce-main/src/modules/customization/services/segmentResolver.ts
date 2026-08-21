import { db } from '@/lib/db/drizzle';
import { analyticsRfmScores, analyticsRfmConfigs } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Resolves a user's RFM segment label from the latest computed scores.
 * Uses the active RFM config and the 30-day window by default.
 * Returns null for guests (no userId) or users without a computed segment.
 */
export async function resolveUserSegment(userId: string | null): Promise<string | null> {
    if (!userId) return null;

    try {
        // Get the active RFM config
        const [activeConfig] = await db
            .select({ id: analyticsRfmConfigs.id })
            .from(analyticsRfmConfigs)
            .where(eq(analyticsRfmConfigs.isActive, true))
            .limit(1);

        if (!activeConfig) return null;

        // Get the user's latest score for the 30-day window
        const [score] = await db
            .select({ segment: analyticsRfmScores.segment })
            .from(analyticsRfmScores)
            .where(
                and(
                    eq(analyticsRfmScores.userId, userId),
                    eq(analyticsRfmScores.configId, activeConfig.id),
                    eq(analyticsRfmScores.windowLabel, '30d'),
                )
            )
            .orderBy(desc(analyticsRfmScores.computedAt))
            .limit(1);

        return score?.segment ?? null;
    } catch (err) {
        console.error('Failed to resolve user segment:', err);
        return null;
    }
}
