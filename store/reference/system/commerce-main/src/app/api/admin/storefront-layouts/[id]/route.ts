import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import * as customizationService from "@/modules/customization/services/customizationService";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) return authResult.response;

    try {
        const body = await req.json();
        const updated = await customizationService.updateLayout(id, body);
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'فشل التحديث' }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) return authResult.response;

    try {
        await customizationService.deleteLayout(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'فشل الحذف' }, { status: 400 });
    }
}
