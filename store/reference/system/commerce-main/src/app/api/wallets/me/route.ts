import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { db } from "@/lib/db/drizzle";
import { walletAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const authResult = await validateRequest(req);
    if (!authResult.success) {
        return authResult.response;
    }

    const userId = authResult.session.user.id;
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
