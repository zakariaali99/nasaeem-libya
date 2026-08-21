import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import { db } from "@/lib/db/drizzle";
import { partnerApps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const { id } = await params;
        const body = await req.json();
        const { status, settledAmount } = body;

        const setValues: any = {};
        if (status !== undefined) setValues.status = status;
        if (settledAmount !== undefined) setValues.settledAmount = settledAmount;

        if (Object.keys(setValues).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        const [updatedPartner] = await db.update(partnerApps)
            .set(setValues)
            .where(eq(partnerApps.id, id))
            .returning();

        if (!updatedPartner) {
            return NextResponse.json({ error: "Partner not found" }, { status: 404 });
        }

        return NextResponse.json({
            message: "Partner updated successfully",
            partner: updatedPartner
        });

    } catch (err: any) {
        console.error("Update partner error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
