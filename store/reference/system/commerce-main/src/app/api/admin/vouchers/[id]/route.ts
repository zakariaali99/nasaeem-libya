import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import { db } from "@/lib/db/drizzle";
import { vouchers, voucherCampaigns } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { eq } from "drizzle-orm";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_FINANCE]);
    if (!authResult.success) {
        return authResult.response;
    }

    const id = (await params).id;

    const voucherObj = await db.query.vouchers.findFirst({
        where: eq(vouchers.id, id),
        with: {
            campaign: true,
            redeemedByUser: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                }
            },
            redemptionTxn: true
        }
    });

    if (!voucherObj) {
        return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }

    // Hide the code_hash from response to admin if we want, or send it (it's hashed anyway).
    // Don't send PII if not needed, but admins might need it.

    return NextResponse.json({
        id: voucherObj.id,
        campaignId: voucherObj.campaignId,
        codeLast4: voucherObj.codeLast4,
        amount: voucherObj.amount,
        currency: voucherObj.currency,
        status: voucherObj.status,
        expiresAt: voucherObj.expiresAt,
        redeemedAt: voucherObj.redeemedAt,
        redeemedBy: voucherObj.redeemedByUser,
        campaign: voucherObj.campaign ? {
            name: voucherObj.campaign.name,
            issuerType: voucherObj.campaign.issuerType,
        } : null
    });
}
