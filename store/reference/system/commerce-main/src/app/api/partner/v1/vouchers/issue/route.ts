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
        const { amount, currency, campaignId, expiresAt } = body;

        if (!amount || amount <= 0 || !currency) {
            const res = NextResponse.json({ error: "Invalid amount or currency" }, { status: 400 });
            await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, await res.clone().json());
            return res;
        }

        let actualCampaignId = campaignId;

        if (!actualCampaignId) {
            // Find or create a generic partner campaign
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

        const code = generateVoucherCode();
        const codeHash = getVoucherCodeHash(code);
        const codeLast4 = code.slice(-4);

        const isTest = partner.mode === "test";

        const [newVoucher] = await db.insert(vouchers).values({
            campaignId: actualCampaignId,
            codeHash,
            codeLast4,
            amount,
            currency,
            partnerId: partner.id,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            status: "active",
            isTest
        }).returning();

        const responseBody = {
            message: "Voucher issued successfully",
            voucher: {
                id: newVoucher.id,
                code: code, // Only show code ONCE
                codeLast4: newVoucher.codeLast4,
                amount: newVoucher.amount,
                currency: newVoucher.currency,
                expiresAt: newVoucher.expiresAt,
                isTest: newVoucher.isTest
            }
        };

        const res = NextResponse.json(responseBody);
        await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, responseBody);
        return res;

    } catch (err: any) {
        const res = NextResponse.json({ error: "Internal server error" }, { status: 500 });
        await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", 500, { error: "Internal server error" });
        return res;
    }
}
