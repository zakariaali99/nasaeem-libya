import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import * as inventoryService from "@/modules/inventory/services/inventoryService";
import { adjustInventorySchema } from "@/modules/inventory/types/inventoryTypes";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
    try {
        const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);
        if (!authResult.success) {
            return authResult.response;
        }

        const body = await req.json();
        const input = adjustInventorySchema.parse(body);

        // Get admin ID from session
        const adminId = authResult.session?.user?.id;
        if (!adminId) {
            return NextResponse.json({ message: "مستخدم غير مصرح له" }, { status: 401 });
        }

        await inventoryService.adjustInventory(input, adminId);

        return NextResponse.json({ message: "تم تحديث المخزون بنجاح" }, { status: 200 });
    } catch (error) {
        console.error("Error adjusting inventory:", error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في تحديث المخزون" }, { status: 500 });
    }
}
