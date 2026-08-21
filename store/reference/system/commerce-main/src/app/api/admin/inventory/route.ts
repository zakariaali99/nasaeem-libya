import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import * as inventoryService from "@/modules/inventory/services/inventoryService";

export async function GET(req: NextRequest) {
    try {
        const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);
        if (!authResult.success) {
            return authResult.response;
        }

        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const search = searchParams.get("search") || undefined;

        if (isNaN(page) || page < 1) {
            return NextResponse.json({ message: "رقم الصفحة غير صالح" }, { status: 400 });
        }
        if (isNaN(limit) || limit < 1) {
            return NextResponse.json({ message: "عدد العناصر غير صالح" }, { status: 400 });
        }

        const result = await inventoryService.listInventoryProducts({ page, limit, search });
        return NextResponse.json({ message: "تم جلب المخزون", data: result }, { status: 200 });
    } catch (error) {
        console.error("Error fetching inventory:", error);
        return NextResponse.json({ message: "خطأ في جلب بيانات المخزون" }, { status: 500 });
    }
}
