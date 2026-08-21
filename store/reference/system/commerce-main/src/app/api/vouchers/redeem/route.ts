import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { redeemVoucher } from "@/lib/services/ledger";

export async function POST(req: NextRequest) {
    const authResult = await validateRequest(req);
    if (!authResult.success) {
        return authResult.response;
    }

    const userId = authResult.session.user.id;
    const idempotencyKey = req.headers.get("x-idempotency-key") || req.headers.get("idempotency-key");

    if (!idempotencyKey) {
        return NextResponse.json({ error: "Idempotency key is required" }, { status: 400 });
    }

    try {
        const body = await req.json();
        const { code, currency = "LYD" } = body;

        if (!code || typeof code !== "string") {
            return NextResponse.json({ error: "Invalid voucher code" }, { status: 400 });
        }

        const result = await redeemVoucher(userId, code, currency, idempotencyKey);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Voucher redeem error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
    }
}
