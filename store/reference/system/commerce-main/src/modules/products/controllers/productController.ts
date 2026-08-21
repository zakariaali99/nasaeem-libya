import { NextRequest, NextResponse } from "next/server"; // Import NextRequest and NextResponse
import { validateRequest } from "@/lib/api-protection";
import { ROLES, PERMISSIONS } from "@/lib/rbac";
import * as productService from "../services/productService";
import { ZodError } from "zod";
import { PaginationParams } from "../types/productTypes";

export async function getProducts(req: NextRequest): Promise<NextResponse> { // Use NextRequest and return NextResponse
    try {
        const authResult = await validateRequest(req, [], true);
        const isAdmin = authResult.session?.user?.role && PERMISSIONS.VIEW_PRODUCTS_INTERNAL.includes(authResult.session.user.role as any);

        // Extract pagination and search parameters from URL search params
        const searchParams = req.nextUrl.searchParams;
        const pageStr = searchParams.get("page");
        const limitStr = searchParams.get("limit");
        const search = searchParams.get("search") || undefined;
        const sortBy = searchParams.get("sortBy") as any;
        const order = searchParams.get("order") as any;
        const minPrice = searchParams.get("minPrice");
        const maxPrice = searchParams.get("maxPrice");
        const categoryId = searchParams.get("categoryId") || undefined;
        const collectionId = searchParams.get("collectionId") || undefined;
        const ids = searchParams.get("ids") ? searchParams.get("ids")?.split(",") : undefined;

        const params: PaginationParams = {
            page: pageStr ? parseInt(pageStr, 10) : undefined,
            limit: limitStr ? parseInt(limitStr, 10) : undefined,
            search: search,
            sortBy: sortBy || undefined,
            order: order || undefined,
            minPrice: minPrice !== null ? parseFloat(minPrice) : undefined,
            maxPrice: maxPrice !== null ? parseFloat(maxPrice) : undefined,
            categoryId,
            collectionId,
            ids,
        };

        // Validate page and limit to be positive integers if provided
        if (params.page !== undefined && (isNaN(params.page) || params.page < 1)) {
            return NextResponse.json({ message: "رقم الصفحة غير صالح" }, { status: 400 });
        }
        if (params.limit !== undefined && (isNaN(params.limit) || params.limit < 1)) {
            return NextResponse.json({ message: "عدد العناصر في الصفحة غير صالح" }, { status: 400 });
        }

        // Pass isAdmin flag to the service
        const paginatedProducts = await productService.listProducts(params, isAdmin);
        // Use NextResponse.json for responses
        return NextResponse.json({ message: "تم جلب المنتجات", data: paginatedProducts }, { status: 200 });
    } catch (error) {
        console.error("Error fetching products:", error); // Log error for debugging
        return NextResponse.json({ message: "خطأ في جلب المنتجات" }, { status: 500 });
    }
}

// Assumes the route parameter is named 'productId', e.g., /api/products/[productId]
export async function getProduct(req: NextRequest, { params }: { params: { productSlugOrId: string } }): Promise<NextResponse> {
    const { productSlugOrId } = await params; // Get productSlugOrId from route parameters

    if (!productSlugOrId || typeof productSlugOrId !== 'string') { // Basic check, route structure usually ensures this
        return NextResponse.json({ message: "معرف المنتج غير صالح" }, { status: 400 });
    }

    try {
        const authResult = await validateRequest(req, [], true);
        const isAdmin = authResult.session?.user?.role && PERMISSIONS.VIEW_PRODUCTS_INTERNAL.includes(authResult.session.user.role as any);

        // Pass isAdmin flag to the service
        const product = await productService.getProductBySlugOrId(productSlugOrId, isAdmin);
        if (!product) return NextResponse.json({ message: "المنتج غير موجود" }, { status: 404 });
        return NextResponse.json({ message: "تم جلب المنتج", data: product }, { status: 200 });
    } catch (error) {
        console.error(`Error fetching product ${productSlugOrId}:`, error); // Log error with productSlugOrId
        return NextResponse.json({ message: "خطأ في جلب المنتج" }, { status: 500 });
    }
}

export async function createProduct(req: NextRequest): Promise<NextResponse> {
    // السماح للمدير فقط - Assuming admin role check is needed
    // Pass the NextRequest directly to getSession if supported, or req.headers
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json(); // Parse the request body
        const newProduct = await productService.createProduct(body);
        // Stock is not calculated on creation, depends on subsequent variant creation
        return NextResponse.json({ message: "تم إنشاء المنتج بنجاح", data: newProduct }, { status: 201 });
    } catch (error) {
        console.error("Error creating product:", error); // Log error
        if (error instanceof ZodError) {
            // Return validation errors
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        // Handle JSON parsing errors specifically
        if (error instanceof SyntaxError) {
            return NextResponse.json({ message: "بيانات الطلب غير صالحة (JSON)" }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في إنشاء المنتج" }, { status: 500 });
    }
}

// Assumes the route parameter is named 'id', e.g., /api/products/[id]
export async function updateProduct(req: NextRequest, { params }: { params: { productSlugOrId: string } }): Promise<NextResponse> {
    const { productSlugOrId } = params; // Get productSlugOrId from route parameters
    // Pass the NextRequest directly to getSession if supported, or req.headers
    const authResult = await validateRequest(req, [...PERMISSIONS.EDIT_PRODUCTS_RESTRICTED]);

    if (!productSlugOrId || typeof productSlugOrId !== 'string') {
        return NextResponse.json({ message: "معرف المنتج غير صالح" }, { status: 400 });
    }

    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json(); // Parse the request body
        const updatedProduct = await productService.updateProduct(productSlugOrId, body);
        if (!updatedProduct) return NextResponse.json({ message: "المنتج غير موجود" }, { status: 404 });
        // Stock is not recalculated on update. Fetch separately if needed.
        return NextResponse.json({ message: "تم تحديث المنتج بنجاح", data: updatedProduct }, { status: 200 });
    } catch (error) {
        console.error(`Error updating product ${productSlugOrId}:`, error); // Log error
        if (error instanceof ZodError) {
            // Return validation errors
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        // Handle JSON parsing errors specifically
        if (error instanceof SyntaxError) {
            return NextResponse.json({ message: "بيانات الطلب غير صالحة (JSON)" }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في تحديث المنتج" }, { status: 500 });
    }
}

// Assumes the route parameter is named 'productSlugOrId', e.g., /api/products/[productSlugOrId]
export async function deleteProduct(req: NextRequest, { params }: { params: { productSlugOrId: string } }): Promise<NextResponse> {
    const { productSlugOrId } = params; // Get productSlugOrId from route parameters
    // Pass the NextRequest directly to getSession if supported, or req.headers
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);

    if (!productSlugOrId || typeof productSlugOrId !== 'string') {
        return NextResponse.json({ message: "معرف المنتج غير صالح" }, { status: 400 });
    }

    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const deleted = await productService.deleteProduct(productSlugOrId);
        if (!deleted) return NextResponse.json({ message: "المنتج غير موجود" }, { status: 404 });
        // Use 204 No Content for successful deletion with no body
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error(`Error deleting product ${productSlugOrId}:`, error); // Log error
        return NextResponse.json({ message: "خطأ في حذف المنتج" }, { status: 500 });
    }
}

export async function bulkUpdate(req: NextRequest): Promise<NextResponse> {
    const authResult = await validateRequest(req, [...PERMISSIONS.EDIT_PRODUCTS_RESTRICTED]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const updates = import("../types/productTypes").then(m => m.bulkUpdateProductSchema.parse(body));
        const resolvedUpdates = await updates;

        const count = await productService.bulkUpdateProducts(resolvedUpdates);

        return NextResponse.json({ message: "تم تحديث المنتجات بنجاح", count }, { status: 200 });
    } catch (error) {
        console.error("Error bulk updating products:", error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في تحديث المنتجات" }, { status: 500 });
    }
}
