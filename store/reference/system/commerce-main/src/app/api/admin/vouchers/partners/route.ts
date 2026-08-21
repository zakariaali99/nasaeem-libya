import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import { db } from "@/lib/db/drizzle";
import { partnerApps, vouchers } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import crypto from "crypto";

// Return API Key hash tool locally for admin creation? We need another hash tool.
import { sha256Hex } from "@/lib/services/partner-auth";

export async function GET(req: NextRequest) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
    if (!authResult.success) {
        return authResult.response;
    }

    const apps = await db.select({
        id: partnerApps.id,
        name: partnerApps.name,
        status: partnerApps.status,
        mode: partnerApps.mode,
        apiKeyId: partnerApps.apiKeyId,
        settledAmount: partnerApps.settledAmount,
        createdAt: partnerApps.createdAt,
        totalIssuedAmount: sql<number>`coalesce(sum(${vouchers.amount}), 0)`.mapWith(Number)
    })
        .from(partnerApps)
        .leftJoin(vouchers, and(
            eq(vouchers.partnerId, partnerApps.id),
            eq(vouchers.isTest, false),
            sql`${vouchers.status} != 'void'`
        ))
        .groupBy(partnerApps.id)
        .orderBy(desc(partnerApps.createdAt));

    return NextResponse.json({
        partners: apps
    });
}

// Create new Partner API Credentials
export async function POST(req: NextRequest) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const { name, allowedIps } = body;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Generate Key ID and Secret
        const apiKeyId = `pk_live_${crypto.randomBytes(12).toString("hex")}`;
        const apiSecretText = `sk_live_${crypto.randomBytes(32).toString("hex")}`;

        // As per design, store hash(secret)
        const apiSecretHash = sha256Hex(apiSecretText);

        const [newApp] = await db.insert(partnerApps).values({
            name,
            apiKeyId,
            apiSecretHash,
            allowedIps: allowedIps ? allowedIps : [],
            status: "active",
            mode: "test"
        }).returning();

        // WARNING: Return the raw SECRET only ONCE!
        return NextResponse.json({
            message: "Partner App Created",
            partner: newApp,
            credentials: {
                apiKeyId,
                apiSecret: apiSecretText,
                warning: "Make sure to copy your API Secret now. You won't be able to see it again!"
            }
        });
    } catch (err: any) {
        console.error("Create partner app error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
