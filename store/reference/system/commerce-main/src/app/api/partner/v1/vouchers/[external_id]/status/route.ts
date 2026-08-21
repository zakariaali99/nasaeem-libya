import { NextRequest, NextResponse } from "next/server";
import { verifyPartnerRequest } from "@/lib/services/partner-auth";
import { db } from "@/lib/db/drizzle";
import { vouchers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ external_id: string }> }
) {
    // We can treat GET queries similarly if signature validates canonical string of GET
    const auth = await verifyPartnerRequest(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const externalId = (await params).external_id;

    const voucher = await db.query.vouchers.findFirst({
        where: (table, { eq, and }) => and(
            eq(table.id, externalId),
            eq(table.partnerId, auth.partner.id)
        )
    });

    if (!voucher) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
        id: voucher.id,
        amount: voucher.amount,
        currency: voucher.currency,
        status: voucher.status,
        expiresAt: voucher.expiresAt,
        redeemedAt: voucher.redeemedAt,
        isTest: voucher.isTest
    });
}
