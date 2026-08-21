import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import { db } from "@/lib/db/drizzle";
import { vouchers, voucherCampaigns } from "@/lib/db/schema";
import { generateVoucherCode, getVoucherCodeHash } from "@/lib/services/ledger";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_FINANCE]);
    if (!authResult.success) {
        return authResult.response;
    }

    // Get active campaigns
    const campaignsList = await db.query.voucherCampaigns.findMany({
        orderBy: [desc(voucherCampaigns.createdAt)]
    });

    // Get recent 100 non-test vouchers with campaign info
    const vouchersList = await db.query.vouchers.findMany({
        where: eq(vouchers.isTest, false),
        orderBy: [desc(vouchers.createdAt)],
        limit: 100,
        with: {
            campaign: true,
            redeemedByUser: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true
                }
            }
        }
    });

    return NextResponse.json({
        vouchers: vouchersList,
        campaigns: campaignsList
    });
}

// Manually Issue Internal Voucher
export async function POST(req: NextRequest) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_FINANCE]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const { amount, currency = "LYD", count = 1, expiresAt } = body;

        if (!amount || amount <= 0 || !count || count <= 0 || count > 100) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        // Find or create "Internal Dashboard" Campaign
        const internalCampName = "Internal-Admin-Dashboard";
        let camp = await db.query.voucherCampaigns.findFirst({
            where: eq(voucherCampaigns.name, internalCampName)
        });

        if (!camp) {
            const [newCamp] = await db.insert(voucherCampaigns).values({
                name: internalCampName,
                issuerType: "internal",
                currency: currency,
                valueType: "fixed",
                fixedAmount: amount
            }).returning();
            camp = newCamp;
        }

        const newVouchersData = Array.from({ length: count }).map(() => {
            const code = generateVoucherCode("ADMIN");
            return {
                code,
                codeHash: getVoucherCodeHash(code),
                codeLast4: code.slice(-4),
                campaignId: camp.id,
                amount,
                currency,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                status: "active" as const
            };
        });

        const insertedVouchers = await db.transaction(async (tx) => {
            return await tx.insert(vouchers).values(
                newVouchersData.map(({ code, ...rest }) => rest)
            ).returning();
        });

        return NextResponse.json({
            message: `${count} vouchers issued manually`,
            vouchers: insertedVouchers.map((v, i) => ({
                id: v.id,
                code: newVouchersData[i].code, // show code only once
                codeLast4: v.codeLast4,
                amount: v.amount,
                currency: v.currency,
                expiresAt: v.expiresAt
            }))
        });
    } catch (err: any) {
        console.error("Admin issue voucher error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
