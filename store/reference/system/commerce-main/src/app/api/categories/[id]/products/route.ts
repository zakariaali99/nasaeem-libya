import { NextRequest, NextResponse } from "next/server";
import { getProductsForCategoryHandler, assignProductToCategoryHandler } from "@/modules/categories/controllers/categoriesController";

interface RouteParams {
    params: Promise<{
        id: string; // Represents categoryId
    }>
}

// GET /api/categories/{categoryId}/products
// Fetches all products assigned to a specific category
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    return getProductsForCategoryHandler(req, { params: { categoryId: id } });
}

// POST /api/categories/{categoryId}/products
// Assigns a product to a category (productId should be in the request body)
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    return assignProductToCategoryHandler(req, { params: { categoryId: id } });
}
