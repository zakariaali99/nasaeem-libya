import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { db } from "@/lib/db/drizzle";
import { walletAccounts, walletTransactions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const authResult = await validateRequest(req);
    if (!authResult.success) {
        return authResult.response;
    }

    const userId = authResult.session.user.id;
    const url = new URL(req.url);
    const currency = url.searchParams.get("currency") || "LYD";
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const wallet = await db.query.walletAccounts.findFirst({
        where: (table, { eq, and }) => and(
            eq(table.userId, userId),
            eq(table.currency, currency)
        )
    });

    if (!wallet) {
        return NextResponse.json({ transactions: [], totalCount: 0 });
    }

    const transactions = await db.query.walletTransactions.findMany({
        where: eq(walletTransactions.walletAccountId, wallet.id),
        orderBy: [desc(walletTransactions.createdAt)],
        limit,
        offset
    });

    return NextResponse.json({
        transactions
    });
}
