import { NextRequest, NextResponse } from 'next/server';
import * as productController from '@/modules/products/controllers/productController';
import { ZodError } from 'zod';

export async function GET(req: NextRequest) {
    try {
        return await productController.getProducts(req);
    } catch (error) {
        console.error("Error fetching products:", error);
        return NextResponse.json({ message: "خطأ في جلب المنتجات" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        return await productController.createProduct(req);
    } catch (error) {
        console.error("Error creating product:", error);
        if (error instanceof ZodError) {
            return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: "خطأ في إنشاء المنتج" }, { status: 500 });
    }
}