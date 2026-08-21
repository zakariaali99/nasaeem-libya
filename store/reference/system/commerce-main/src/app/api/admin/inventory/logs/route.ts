import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { PERMISSIONS } from "@/lib/rbac";
import { db } from "@/lib/db/drizzle";
import { inventoryTransactions, products, productVariants } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { count, eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
    try {
        const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);
        if (!authResult.success) {
            return authResult.response;
        }

        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "10", 10);

        if (isNaN(page) || page < 1) {
            return NextResponse.json({ message: "رقم الصفحة غير صالح" }, { status: 400 });
        }
        if (isNaN(limit) || limit < 1) {
            return NextResponse.json({ message: "عدد العناصر غير صالح" }, { status: 400 });
        }

        const offset = (page - 1) * limit;

        const [dbData, totalRes] = await Promise.all([
            db.select({
                id: inventoryTransactions.id,
                productId: inventoryTransactions.productId,
                variantId: inventoryTransactions.variantId,
                quantity: inventoryTransactions.quantity,
                type: inventoryTransactions.type,
                reference: inventoryTransactions.reference,
                notes: inventoryTransactions.notes,
                createdAt: inventoryTransactions.createdAt,
                createdBy: inventoryTransactions.createdBy,
                productName: products.name,
                variantTitle: productVariants.title,
                adminName: user.name,
            })
                .from(inventoryTransactions)
                .leftJoin(products, eq(inventoryTransactions.productId, products.id))
                .leftJoin(productVariants, eq(inventoryTransactions.variantId, productVariants.id))
                .leftJoin(user, eq(inventoryTransactions.createdBy, user.id))
                .limit(limit)
                .offset(offset)
                .orderBy(desc(inventoryTransactions.createdAt)),
            db.select({ count: count() }).from(inventoryTransactions)
        ]);

        const total = totalRes[0]?.count ?? 0;

        return NextResponse.json({
            message: "تم جلب سجل المخزون",
            data: {
                data: dbData,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        }, { status: 200 });
    } catch (error) {
        console.error("Error fetching inventory logs:", error);
        return NextResponse.json({ message: "خطأ في جلب السجل" }, { status: 500 });
    }
}
