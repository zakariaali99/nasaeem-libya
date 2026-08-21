import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-protection';
import { PERMISSIONS } from '@/lib/rbac';
import { db } from '@/lib/db/drizzle';
import { cities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Hardcoded from rfmCalculator.ts — these only change when code changes
const RFM_SEGMENTS = [
    'عميل ذهبي',
    'عميل وفي',
    'عميل معرض للفقد',
    'عميل جديد واعد',
    'عميل قياسي',
];

/**
 * GET /api/admin/segments
 * Returns available segment labels, auth status options, and cities for admin targeting UI.
 */
export async function GET(req: NextRequest) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) {
        return authResult.response;
    }

    // Cities are a small finite list, safe to query
    const activeCities = await db
        .select({ name: cities.name })
        .from(cities)
        .where(eq(cities.isActive, true))
        .catch(() => []);

    return NextResponse.json({
        segments: RFM_SEGMENTS,
        authStatuses: [
            { value: 'guest', label: 'زوار (غير مسجلين)' },
            { value: 'authenticated', label: 'مسجلين' },
        ],
        cities: activeCities.map((c) => c.name),
    });
}
