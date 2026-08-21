import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { createWalletTopup } from "@/lib/services/ledger";

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
        const { amount, currency = "LYD", referenceType = "payment_intent", referenceId } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }

        const result = await createWalletTopup(
            userId,
            amount,
            currency,
            referenceType,
            referenceId || "unknown", // in real world, this comes from a verified payment intent
            idempotencyKey
        );

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Topup error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
