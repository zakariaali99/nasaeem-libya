import { NextRequest, NextResponse } from 'next/server';
import * as cartService from '@/modules/cart/services/cartService';
import { auth } from '@/lib/auth';

async function getUserIdFromSession(req: NextRequest): Promise<string | null> {
    const session = await auth.api.getSession(req);
    return session?.user.id || null;
}

// POST /api/cart/checkout - Proceed to checkout
export async function POST(req: NextRequest) {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
    }
    try {
        // Validate cart before creating order
        const cart = await cartService.getCartContents(userId);
        if (!cart.items.length) {
            return NextResponse.json({ message: 'لا يمكن الدفع وسلة التسوق فارغة' }, { status: 400 });
        }
        if (!cart.deliveryRegionId && !cart.deliveryCityId) {
            return NextResponse.json({ message: 'يرجى تحديد مدينة أو منطقة التوصيل' }, { status: 400 });
        }
        if (!cart.address || cart.address.trim() === '') {
            return NextResponse.json({ message: 'يرجى إدخال عنوان التوصيل' }, { status: 400 });
        }
        // Create order from cart and return new orderId and orderNumber
        const { orderId, orderNumber } = await cartService.createOrderFromCart(userId);
        return NextResponse.json({ orderId, orderNumber }, { status: 200 });
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ في الخادم';
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
