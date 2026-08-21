import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import * as customizationService from "@/modules/customization/services/customizationService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) return authResult.response;

    try {
        const body = await req.json();
        const copyName = body.name || "نسخة من التخطيط";
        const newLayout = await customizationService.duplicateLayout(id, copyName);
        return NextResponse.json(newLayout, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'فشل نسخ التخطيط' }, { status: 400 });
    }
}
