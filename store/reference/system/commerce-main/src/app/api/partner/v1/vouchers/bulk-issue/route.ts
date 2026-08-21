import { NextRequest, NextResponse } from "next/server";
import { verifyPartnerRequest, logPartnerResponse } from "@/lib/services/partner-auth";
import { generateVoucherCode, getVoucherCodeHash } from "@/lib/services/ledger";
import { db } from "@/lib/db/drizzle";
import { vouchers, voucherCampaigns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
    const auth = await verifyPartnerRequest(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { partner } = auth;
    const reqClone = req.clone();

    try {
        const body = await reqClone.json();
        const { amount, currency, campaignId, expiresAt, count } = body;

        if (!amount || amount <= 0 || !currency || !count || count <= 0 || count > 1000) {
            const res = NextResponse.json({ error: "Invalid parameters (max 1000 count)" }, { status: 400 });
            await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, await res.clone().json());
            return res;
        }

        let actualCampaignId = campaignId;

        if (!actualCampaignId) {
            const genericCampaignName = `Partner-${partner.name}-Default`;
            let camp = await db.query.voucherCampaigns.findFirst({
                where: eq(voucherCampaigns.name, genericCampaignName)
            });
            if (!camp) {
                const [newCamp] = await db.insert(voucherCampaigns).values({
                    name: genericCampaignName,
                    issuerType: "partner",
                    issuerId: partner.id,
                    currency: currency,
                    valueType: "variable",
                }).returning();
                camp = newCamp;
            }
            actualCampaignId = camp.id;
        }

        const isTest = partner.mode === "test";

        const newVouchersData = Array.from({ length: count }).map(() => {
            const code = generateVoucherCode();
            return {
                code,
                codeHash: getVoucherCodeHash(code),
                codeLast4: code.slice(-4),
                campaignId: actualCampaignId,
                amount,
                currency,
                partnerId: partner.id,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                status: "active" as const,
                isTest
            };
        });

        const insertedVouchers = await db.transaction(async (tx) => {
            return await tx.insert(vouchers).values(
                newVouchersData.map(({ code, ...rest }) => rest)
            ).returning();
        });

        const responseBody = {
            message: `${count} vouchers issued successfully`,
            vouchers: insertedVouchers.map((v, i) => ({
                id: v.id,
                code: newVouchersData[i].code, // Only show code ONCE
                codeLast4: v.codeLast4,
                amount: v.amount,
                currency: v.currency,
                expiresAt: v.expiresAt,
                isTest: v.isTest
            }))
        };

        const res = NextResponse.json(responseBody);
        await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, responseBody);
        return res;

    } catch (err: any) {
        console.error("Bulk issue error:", err);
        const res = NextResponse.json({ error: "Internal server error" }, { status: 500 });
        await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", 500, { error: "Internal server error" });
        return res;
    }
}
