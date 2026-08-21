import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { db } from "@/lib/db/drizzle";
import { adjustWalletBalance } from "@/lib/services/ledger";

// GET user wallet
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ userId: string }> }
) {
    const authResult = await validateRequest(req, ["admin"]);
    if (!authResult.success) {
        return authResult.response;
    }

    const { userId } = await context.params;
    const url = new URL(req.url);
    const currency = url.searchParams.get("currency") || "LYD";

    const wallet = await db.query.walletAccounts.findFirst({
        where: (table, { eq, and }) => and(
            eq(table.userId, userId),
            eq(table.currency, currency)
        )
    });

    if (!wallet) {
        return NextResponse.json({
            wallet: {
                currency,
                currentBalance: 0,
                status: "active"
            }
        });
    }

    return NextResponse.json({
        wallet: {
            id: wallet.id,
            currency: wallet.currency,
            currentBalance: wallet.currentBalance,
            status: wallet.status
        }
    });
}

// POST admin wallet adjustment
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ userId: string }> }
) {
    const authResult = await validateRequest(req, ["admin"]);
    if (!authResult.success) {
        return authResult.response;
    }

    const { userId } = await context.params;
    const adminId = authResult.session.user.id;

    try {
        const body = await req.json();
        const { amount, currency = "LYD", reason, idempotencyKey } = body;

        if (!amount || isNaN(Number(amount))) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }
        if (!reason || typeof reason !== "string") {
            return NextResponse.json({ error: "Reason for adjustment is required" }, { status: 400 });
        }

        const result = await adjustWalletBalance(
            userId,
            Number(amount),
            currency,
            reason,
            adminId,
            idempotencyKey
        );

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Wallet adjustment error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
    }
}
