import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { ROLES, PERMISSIONS } from "@/lib/rbac";
import * as optionService from "../services/optionService";
import { ZodError } from "zod";
import {
    PaginationParams,
    createOptionSchema, updateOptionSchema,
    createOptionValueSchema, updateOptionValueSchema
} from "../types/optionTypes";

// --- Option Controllers ---

export async function listOptions(req: NextRequest): Promise<NextResponse> {
    try {
        // Options are generally public, but admin might see more details in future?
        // For now, no specific admin check for listing.

        const searchParams = req.nextUrl.searchParams;
        const pageStr = searchParams.get("page");
        const limitStr = searchParams.get("limit");
        const search = searchParams.get("search") || undefined;

        const params: PaginationParams = {
            page: pageStr ? parseInt(pageStr, 10) : undefined,
            limit: limitStr ? parseInt(limitStr, 10) : undefined,
            search: search,
        };

        if (params.page !== undefined && (isNaN(params.page) || params.page < 1)) {
            return NextResponse.json({ message: "رقم الصفحة غير صالح" }, { status: 400 });
        }
        if (params.limit !== undefined && (isNaN(params.limit) || params.limit < 1)) {
            return NextResponse.json({ message: "عدد العناصر في الصفحة غير صالح" }, { status: 400 });
        }

        const paginatedOptions = await optionService.listOptions(params);
        return NextResponse.json({ message: "تم جلب الخصائص", data: paginatedOptions }, { status: 200 });
    } catch (error) {
        console.error("Error fetching options:", error);
        return NextResponse.json({ message: "خطأ في جلب الخصائص" }, { status: 500 });
    }
}

export async function getOption(req: NextRequest, { params }: { params: { optionId: string } }): Promise<NextResponse> {
    const { optionId } = params;

    if (!optionId || typeof optionId !== 'string') {
        return NextResponse.json({ message: "معرف الخاصية غير صالح" }, { status: 400 });
    }

    try {
        // No admin check needed for getting a single option by ID (usually public)
        const option = await optionService.getOptionById(optionId);
        if (!option) return NextResponse.json({ message: "الخاصية غير موجودة" }, { status: 404 });
        return NextResponse.json({ message: "تم جلب الخاصية", data: option }, { status: 200 });
    } catch (error) {
        console.error(`Error fetching option ${optionId}:`, error);
        return NextResponse.json({ message: "خطأ في جلب الخاصية" }, { status: 500 });
    }
}

export async function createOption(req: NextRequest): Promise<NextResponse> {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const validatedData = createOptionSchema.parse(body);
        const newOption = await optionService.createOption(validatedData);
        return NextResponse.json({ message: "تم إنشاء الخاصية بنجاح", data: newOption }, { status: 201 });
    } catch (error) {
        console.error("Error creating option:", error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ message: "بيانات الطلب غير صالحة (JSON)" }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في إنشاء الخاصية" }, { status: 500 });
    }
}

export async function updateOption(req: NextRequest, { params }: { params: { optionId: string } }): Promise<NextResponse> {
    const { optionId } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);

    if (!optionId || typeof optionId !== 'string') {
        return NextResponse.json({ message: "معرف الخاصية غير صالح" }, { status: 400 });
    }
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const validatedData = updateOptionSchema.parse(body);
        const updatedOption = await optionService.updateOption(optionId, validatedData);
        if (!updatedOption) return NextResponse.json({ message: "الخاصية غير موجودة" }, { status: 404 });
        return NextResponse.json({ message: "تم تحديث الخاصية بنجاح", data: updatedOption }, { status: 200 });
    } catch (error) {
        console.error(`Error updating option ${optionId}:`, error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ message: "بيانات الطلب غير صالحة (JSON)" }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في تحديث الخاصية" }, { status: 500 });
    }
}

export async function deleteOption(req: NextRequest, { params }: { params: { optionId: string } }): Promise<NextResponse> {
    const { optionId } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);

    if (!optionId || typeof optionId !== 'string') {
        return NextResponse.json({ message: "معرف الخاصية غير صالح" }, { status: 400 });
    }
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const deleted = await optionService.deleteOption(optionId);
        if (!deleted) return NextResponse.json({ message: "الخاصية غير موجودة" }, { status: 404 });
        return new NextResponse(null, { status: 204 }); // No Content
    } catch (error) {
        console.error(`Error deleting option ${optionId}:`, error);
        // Consider potential foreign key constraint errors if option is in use
        return NextResponse.json({ message: "خطأ في حذف الخاصية" }, { status: 500 });
    }
}

// --- Option Value Controllers ---

export async function listOptionValues(req: NextRequest, { params }: { params: { optionId: string } }): Promise<NextResponse> {
    const { optionId } = params;

    if (!optionId || typeof optionId !== 'string') {
        return NextResponse.json({ message: "معرف الخاصية غير صالح" }, { status: 400 });
    }

    try {
        // Option values are generally public
        const searchParams = req.nextUrl.searchParams;
        const pageStr = searchParams.get("page");
        const limitStr = searchParams.get("limit");
        const search = searchParams.get("search") || undefined;

        const paginationParams: PaginationParams = {
            page: pageStr ? parseInt(pageStr, 10) : undefined,
            limit: limitStr ? parseInt(limitStr, 10) : undefined,
            search: search,
        };

        if (paginationParams.page !== undefined && (isNaN(paginationParams.page) || paginationParams.page < 1)) {
            return NextResponse.json({ message: "رقم الصفحة غير صالح" }, { status: 400 });
        }
        if (paginationParams.limit !== undefined && (isNaN(paginationParams.limit) || paginationParams.limit < 1)) {
            return NextResponse.json({ message: "عدد العناصر في الصفحة غير صالح" }, { status: 400 });
        }

        // Check if the parent option exists first
        const optionExists = await optionService.getOptionById(optionId);
        if (!optionExists) {
            return NextResponse.json({ message: "الخاصية الأم غير موجودة" }, { status: 404 });
        }

        const paginatedValues = await optionService.listOptionValues(optionId, paginationParams);
        return NextResponse.json({ message: "تم جلب قيم الخاصية", data: paginatedValues }, { status: 200 });
    } catch (error) {
        console.error(`Error fetching values for option ${optionId}:`, error);
        return NextResponse.json({ message: "خطأ في جلب قيم الخاصية" }, { status: 500 });
    }
}

export async function getOptionValue(req: NextRequest, { params }: { params: { optionId: string, valueId: string } }): Promise<NextResponse> {
    const { optionId, valueId } = params;

    if (!optionId || typeof optionId !== 'string' || !valueId || typeof valueId !== 'string') {
        return NextResponse.json({ message: "معرف الخاصية أو القيمة غير صالح" }, { status: 400 });
    }

    try {
        // No admin check needed for getting a single value by ID
        const value = await optionService.getOptionValueById(valueId);
        // Optional: Check if value.optionId matches the route's optionId
        if (!value || value.optionId !== optionId) {
            return NextResponse.json({ message: "قيمة الخاصية غير موجودة" }, { status: 404 });
        }
        return NextResponse.json({ message: "تم جلب قيمة الخاصية", data: value }, { status: 200 });
    } catch (error) {
        console.error(`Error fetching option value ${valueId} for option ${optionId}:`, error);
        return NextResponse.json({ message: "خطأ في جلب قيمة الخاصية" }, { status: 500 });
    }
}

export async function createOptionValue(req: NextRequest, { params }: { params: { optionId: string } }): Promise<NextResponse> {
    const { optionId } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);

    if (!optionId || typeof optionId !== 'string') {
        return NextResponse.json({ message: "معرف الخاصية غير صالح" }, { status: 400 });
    }
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        // Check if the parent option exists first
        const optionExists = await optionService.getOptionById(optionId);
        if (!optionExists) {
            return NextResponse.json({ message: "الخاصية الأم غير موجودة" }, { status: 404 });
        }

        const body = await req.json();
        const validatedData = createOptionValueSchema.parse(body);
        const newValue = await optionService.createOptionValue(optionId, validatedData);
        return NextResponse.json({ message: "تم إنشاء قيمة الخاصية بنجاح", data: newValue }, { status: 201 });
    } catch (error) {
        console.error(`Error creating value for option ${optionId}:`, error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ message: "بيانات الطلب غير صالحة (JSON)" }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في إنشاء قيمة الخاصية" }, { status: 500 });
    }
}

export async function updateOptionValue(req: NextRequest, { params }: { params: { optionId: string, valueId: string } }): Promise<NextResponse> {
    const { optionId, valueId } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);

    if (!optionId || typeof optionId !== 'string' || !valueId || typeof valueId !== 'string') {
        return NextResponse.json({ message: "معرف الخاصية أو القيمة غير صالح" }, { status: 400 });
    }
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const validatedData = updateOptionValueSchema.parse(body);

        // Optional: Check if the value actually belongs to the optionId in the route
        const existingValue = await optionService.getOptionValueById(valueId);
        if (!existingValue || existingValue.optionId !== optionId) {
            return NextResponse.json({ message: "قيمة الخاصية غير موجودة ضمن هذه الخاصية" }, { status: 404 });
        }

        const updatedValue = await optionService.updateOptionValue(valueId, validatedData);
        if (!updatedValue) return NextResponse.json({ message: "قيمة الخاصية غير موجودة" }, { status: 404 }); // Should be caught above, but good failsafe
        return NextResponse.json({ message: "تم تحديث قيمة الخاصية بنجاح", data: updatedValue }, { status: 200 });
    } catch (error) {
        console.error(`Error updating option value ${valueId} for option ${optionId}:`, error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ message: "بيانات الطلب غير صالحة (JSON)" }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في تحديث قيمة الخاصية" }, { status: 500 });
    }
}

export async function deleteOptionValue(req: NextRequest, { params }: { params: { optionId: string, valueId: string } }): Promise<NextResponse> {
    const { optionId, valueId } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_PRODUCTS]);

    if (!optionId || typeof optionId !== 'string' || !valueId || typeof valueId !== 'string') {
        return NextResponse.json({ message: "معرف الخاصية أو القيمة غير صالح" }, { status: 400 });
    }
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        // Optional: Check if the value belongs to the option before deleting
        const existingValue = await optionService.getOptionValueById(valueId);
        if (!existingValue || existingValue.optionId !== optionId) {
            return NextResponse.json({ message: "قيمة الخاصية غير موجودة ضمن هذه الخاصية" }, { status: 404 });
        }

        const deleted = await optionService.deleteOptionValue(valueId);
        if (!deleted) return NextResponse.json({ message: "قيمة الخاصية غير موجودة" }, { status: 404 }); // Should be caught above
        return new NextResponse(null, { status: 204 }); // No Content
    } catch (error) {
        console.error(`Error deleting option value ${valueId} for option ${optionId}:`, error);
        // Consider potential foreign key constraint errors if value is in use by variants
        return NextResponse.json({ message: "خطأ في حذف قيمة الخاصية" }, { status: 500 });
    }
}
