import {
    getCategory,
    updateCategory,
    deleteCategory,
    assignProductToCategoryHandler,
    removeProductFromCategoryHandler,
    getProductsForCategoryHandler
} from "@/modules/categories/controllers/categoriesController";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
    params: Promise<{
        id: string; // Represents categoryId
        productId?: string; // Optional productId for product-specific actions under a category
    }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    // If a productId is present in the path like /api/categories/{id}/products, route to getProductsForCategoryHandler
    // This requires a different route structure, e.g., /api/categories/[id]/products
    // For now, this GET targets only fetching a single category by its ID.
    const { id } = await params;
    return getCategory(req, { params: { categoryId: id } });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    return updateCategory(req, { params: { categoryId: id } });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    // This route is for deleting a category. 
    // For deleting a product from a category, a more specific route like /api/categories/[id]/products/[productId] would be conventional.
    const { id } = await params;
    return deleteCategory(req, { params: { categoryId: id } });
}

// Note: For assigning/removing products, the routes would typically be more specific.
// For example:
// POST /api/categories/{categoryId}/products - to assign a product (productId in body)
// DELETE /api/categories/{categoryId}/products/{productId} - to remove a product

// Let's create these more specific routes in a new file structure if needed.
// For now, adding a POST to this [id] route for assignment, assuming productId is in the body.

export async function POST(req: NextRequest, { params }: RouteParams) {
    // This will be used for assigning a product to a category.
    // The productId should be in the request body.
    const { id } = await params;
    return assignProductToCategoryHandler(req, { params: { categoryId: id } });
}

// To handle GET for products of a category and DELETE for removing a product from a category,
// we need a route structure that can accept both categoryId and productId, or a query param.
// A common RESTful pattern is /api/categories/[categoryId]/products/[productId]
// Or /api/categories/[categoryId]/products for GET and specific product actions via body/query params.

// Let's adjust the API structure. We'll need a new route file for /api/categories/[id]/products/[productId]/route.ts
// And another for /api/categories/[id]/products/route.ts
