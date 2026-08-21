import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import * as customizationService from "@/modules/customization/services/customizationService";

export async function GET(req: NextRequest) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) return authResult.response;

    try {
        const layouts = await customizationService.listLayouts();
        return NextResponse.json({ data: layouts });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'حدث خطأ' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) return authResult.response;

    try {
        const body = await req.json();
        const newLayout = await customizationService.createLayout(body);
        return NextResponse.json(newLayout, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'فشل إنشاء التخطيط' }, { status: 400 });
    }
}
