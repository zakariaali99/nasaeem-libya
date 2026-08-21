import { NextRequest, NextResponse } from 'next/server';
import * as cartService from '@/modules/cart/services/cartService';
import { UpdateCartDetailsSchema } from '@/modules/cart/types/cartTypes';
import { auth } from '@/lib/auth';

async function getUserIdFromSession(req: NextRequest): Promise<string | null> {
    const session = await auth.api.getSession(req);
    return session?.user.id || null;
}

// POST /api/cart/details - Update cart details
export async function POST(req: NextRequest) {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const validation = UpdateCartDetailsSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'بيانات غير صالحة', errors: validation.error.errors }, { status: 400 });
        }
        await cartService.updateCartDetails(userId, validation.data);
        const cart = await cartService.getCartContents(userId);
        return NextResponse.json(cart, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
    }
}
