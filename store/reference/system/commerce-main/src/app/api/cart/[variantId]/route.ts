import { NextRequest, NextResponse } from 'next/server';
import * as cartService from '@/modules/cart/services/cartService';
import { auth } from '@/lib/auth';
import { z } from 'zod';

async function getUserIdFromSession(req: NextRequest): Promise<string | null> {
    const session = await auth.api.getSession(req);
    return session?.user.id || null;
}

const RouteParamsSchema = z.object({
    variantId: z.string().uuid(),
});

// DELETE /api/cart/[variantId] - Remove a specific item from the cart
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) {
    const userId = await getUserIdFromSession(req);
    const body = await params;
    if (!userId) {
        return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
    }

    const validation = RouteParamsSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ message: 'معرف المنتج غير صالح', errors: validation.error.errors }, { status: 400 });
    }

    try {
        await cartService.removeItemFromCart(userId, validation.data.variantId);
        return NextResponse.json({ message: 'تمت إزالة المنتج من السلة' }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
    }
}

// PUT /api/cart/[variantId] - Update the quantity of a specific item in the cart
export async function PUT(req: NextRequest, { params }: { params: Promise<{ variantId: string }> }) {
    const { variantId } = await params;
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
    }

    const body = await req.json();
    const validation = z.object({
        quantity: z.number().min(1)
    }).safeParse(body);

    if (!validation.success) {
        return NextResponse.json({ message: 'بيانات الطلب غير صالحة', errors: validation.error.errors }, { status: 400 });
    }

    try {
        await cartService.updateItemQuantity(userId, variantId, validation.data.quantity);
        return NextResponse.json({ message: 'تم تحديث كمية المنتج في السلة' }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
    }
}