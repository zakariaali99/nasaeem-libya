import { NextRequest, NextResponse } from "next/server"; // Import NextRequest and NextResponse
import { validateRequest } from "@/lib/api-protection";
import { ROLES, PERMISSIONS } from "@/lib/rbac";
import * as variantService from "../services/variantService"; // Import variant service
import { ZodError } from "zod";
import { PaginationParams } from "../types/variantTypes"; // Use variant types

// Get a list of variants, optionally filtered by productId
export async function getVariants(req: NextRequest): Promise<NextResponse> {
    try {
        const searchParams = req.nextUrl.searchParams;
        const pageStr = searchParams.get("page");
        const limitStr = searchParams.get("limit");
        const search = searchParams.get("search") || undefined;
        const productId = searchParams.get("productId") || undefined; // Get optional productId

        const params: PaginationParams = {
            page: pageStr ? parseInt(pageStr, 10) : undefined,
            limit: limitStr ? parseInt(limitStr, 10) : undefined,
            search: search,
            productId: productId, // Pass productId to service
        };

        // Validate page and limit
        if (params.page !== undefined && (isNaN(params.page) || params.page < 1)) {
            return NextResponse.json({ message: "رقم الصفحة غير صالح" }, { status: 400 });
        }
        if (params.limit !== undefined && (isNaN(params.limit) || params.limit < 1)) {
            return NextResponse.json({ message: "عدد العناصر في الصفحة غير صالح" }, { status: 400 });
        }
        // Validate productId if provided (basic UUID check example)
        if (params.productId !== undefined && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(params.productId)) {
            return NextResponse.json({ message: "معرف المنتج غير صالح" }, { status: 400 });
        }


        const paginatedVariants = await variantService.listVariants(params);
        return NextResponse.json({ message: "تم جلب المتغيرات", data: paginatedVariants }, { status: 200 });
    } catch (error) {
        console.error("Error fetching variants:", error);
        return NextResponse.json({ message: "خطأ في جلب المتغيرات" }, { status: 500 });
    }
}

// Get a single variant by ID
// Assumes route parameter is named 'variantId', e.g., /api/variants/[variantId]
export async function getVariant(req: NextRequest, { params }: { params: { variantId: string } }): Promise<NextResponse> {
    const { variantId } = params;

    if (!variantId || typeof variantId !== 'string') { // Basic check
        return NextResponse.json({ message: "معرف المتغير غير صالح" }, { status: 400 });
    }

    // Public endpoint? Or requires auth? Decide based on requirements.
    // const session = await auth.api.getSession({ req });
    // if (!session) return NextResponse.json({ message: "غير مصرح" }, { status: 401 });

    try {
        const variant = await variantService.getVariantById(variantId);
        if (!variant) return NextResponse.json({ message: "المتغير غير موجود" }, { status: 404 });
        return NextResponse.json({ message: "تم جلب المتغير", data: variant }, { status: 200 });
    } catch (error) {
        console.error(`Error fetching variant ${variantId}:`, error);
        return NextResponse.json({ message: "خطأ في جلب المتغير" }, { status: 500 });
    }
}

// Create a new variant
export async function createVariant(req: NextRequest): Promise<NextResponse> {
    // Admin only
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        // productId must be in the body and validated by the schema
        const newVariant = await variantService.createVariant(body);
        return NextResponse.json({ message: "تم إنشاء المتغير بنجاح", data: newVariant }, { status: 201 });
    } catch (error) {
        console.error("Error creating variant:", error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ message: "بيانات الطلب غير صالحة (JSON)" }, { status: 400 });
        }
        // Handle potential foreign key constraint errors if productId is invalid
        // This might require checking the error code or message from the database driver
        return NextResponse.json({ message: "خطأ في إنشاء المتغير" }, { status: 500 });
    }
}

// Update an existing variant
// Assumes route parameter is named 'variantId', e.g., /api/variants/[variantId]
export async function updateVariant(req: NextRequest, { params }: { params: { variantId: string } }): Promise<NextResponse> {
    const { variantId } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.EDIT_PRODUCTS_RESTRICTED]);

    if (!variantId || typeof variantId !== 'string') {
        return NextResponse.json({ message: "معرف المتغير غير صالح" }, { status: 400 });
    }

    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const updatedVariant = await variantService.updateVariant(variantId, body);
        if (!updatedVariant) return NextResponse.json({ message: "المتغير غير موجود" }, { status: 404 });
        return NextResponse.json({ message: "تم تحديث المتغير بنجاح", data: updatedVariant }, { status: 200 });
    } catch (error) {
        console.error(`Error updating variant ${variantId}:`, error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ message: "بيانات الطلب غير صالحة (JSON)" }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في تحديث المتغير" }, { status: 500 });
    }
}

// Delete a variant
// Assumes route parameter is named 'variantId', e.g., /api/variants/[variantId]
export async function deleteVariant(req: NextRequest, { params }: { params: { variantId: string } }): Promise<NextResponse> {
    const { variantId } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);

    if (!variantId || typeof variantId !== 'string') {
        return NextResponse.json({ message: "معرف المتغير غير صالح" }, { status: 400 });
    }

    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const deleted = await variantService.deleteVariant(variantId);
        if (!deleted) return NextResponse.json({ message: "المتغير غير موجود" }, { status: 404 });
        return new NextResponse(null, { status: 204 }); // 204 No Content
    } catch (error) {
        console.error(`Error deleting variant ${variantId}:`, error);
        // Handle potential foreign key constraints if the variant is referenced elsewhere (e.g., order items)
        return NextResponse.json({ message: "خطأ في حذف المتغير" }, { status: 500 });
    }
}
