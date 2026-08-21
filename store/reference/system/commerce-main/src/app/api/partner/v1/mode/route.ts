import { NextRequest, NextResponse } from "next/server";
import { verifyPartnerRequest, logPartnerResponse } from "@/lib/services/partner-auth";
import { db } from "@/lib/db/drizzle";
import { partnerApps } from "@/lib/db/schema";
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
        const { mode } = body;

        if (mode !== "test" && mode !== "live") {
            const res = NextResponse.json({ error: "Invalid mode. Must be 'test' or 'live'" }, { status: 400 });
            await logPartnerResponse(partner.id, req.headers.get("X-Idempotency-Key")!, "", res.status, await res.clone().json());
            return res;
        }

        await db.update(partnerApps)
            .set({ mode })
            .where(eq(partnerApps.id, partner.id));

        const responseBody = {
            message: `Partner app mode switched to ${mode}`,
            mode
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
