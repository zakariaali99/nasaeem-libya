import { NextRequest, NextResponse } from "next/server";
import { verifyPartnerRequest, logPartnerResponse } from "@/lib/services/partner-auth";
import { db } from "@/lib/db/drizzle";
import { vouchers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    const auth = await verifyPartnerRequest(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { partner } = auth;
    const reqClone = req.clone();

    try {
        const body = await reqClone.json();
        const { voucherId } = body;

        if (!voucherId) {
            const res = NextResponse.json({ error: "voucherId required" }, { status: 400 });
            await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, await res.clone().json());
            return res;
        }

        const voucher = await db.query.vouchers.findFirst({
            where: (table, { eq, and }) => and(
                eq(table.id, voucherId),
                eq(table.partnerId, partner.id) // Only allow voiding their own vouchers
            )
        });

        if (!voucher) {
            const res = NextResponse.json({ error: "Voucher not found or access denied" }, { status: 404 });
            await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, await res.clone().json());
            return res;
        }

        if (voucher.status !== "active") {
            const res = NextResponse.json({ error: `Cannot void voucher in status: ${voucher.status}` }, { status: 400 });
            await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, await res.clone().json());
            return res;
        }

        await db.update(vouchers)
            .set({ status: "void" })
            .where(eq(vouchers.id, voucher.id));

        const responseBody = { message: "Voucher voided successfully", voucherId: voucher.id };
        const res = NextResponse.json(responseBody);
        await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, responseBody);
        return res;

    } catch (err: any) {
        const res = NextResponse.json({ error: "Internal server error" }, { status: 500 });
        await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", 500, { error: "Internal server error" });
        return res;
    }
}
