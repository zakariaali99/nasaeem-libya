import { NextRequest, NextResponse } from "next/server";
import { removeProductFromCategoryHandler } from "@/modules/categories/controllers/categoriesController";

interface RouteParams {
    params: Promise<{
        id: string; // Represents categoryId
        productId: string; // Represents productId
    }>
}

// DELETE /api/categories/{categoryId}/products/{productId}
// Removes a specific product from a specific category
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { id, productId } = await params;
    return removeProductFromCategoryHandler(req, { params: { categoryId: id, productId: productId } });
}
