import { NextRequest, NextResponse } from 'next/server';
import * as productController from '@/modules/products/controllers/productController';
import { ZodError } from 'zod';

interface RouteParams {
    params: Promise<{ productSlugOrId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    const { productSlugOrId } = await params;
    try {
        return await productController.getProduct(req, { params: { productSlugOrId } });
    } catch (error) {
        console.error(`Error fetching product ${productSlugOrId}:`, error);
        return NextResponse.json({ message: "خطأ في جلب المنتج" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    const { productSlugOrId } = await params;
    try {
        return await productController.updateProduct(req, { params: { productSlugOrId } });

    } catch (error) {
        console.error(`Error updating product ${productSlugOrId}:`, error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في تحديث المنتج" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { productSlugOrId } = await params;
    try {
        return await productController.deleteProduct(req, { params: { productSlugOrId } });

    } catch (error) {
        console.error(`Error deleting product ${productSlugOrId}:`, error);
        return NextResponse.json({ message: "خطأ في حذف المنتج" }, { status: 500 });
    }
}