import { NextRequest, NextResponse } from 'next/server';
import * as cartService from '@/modules/cart/services/cartService';
import { AddToCartSchema, UpdateCartItemQuantitySchema, RemoveFromCartSchema, UpdateCartDetailsSchema } from '@/modules/cart/types/cartTypes';
import { auth } from '@/lib/auth';

async function getUserIdFromSession(req: NextRequest): Promise<string | null> {
    const session = await auth.api.getSession(req);
    return session?.user.id || null;
}

// GET /api/cart - Get cart contents
export async function GET(req: NextRequest) {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
    }

    try {
        const cart = await cartService.getCartContents(userId);
        return NextResponse.json(cart);
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ message: error?.message || 'حدث خطأ في عرض السلة' }, { status: 500 });
    }
}

// POST /api/cart - Add item to cart
export async function POST(req: NextRequest) {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const validation = AddToCartSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'بيانات غير صالحة', errors: validation.error.errors }, { status: 400 });
        }
        await cartService.addItemToCart(userId, validation.data);
        return NextResponse.json({ message: 'تمت إضافة المنتج إلى السلة' }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
    }
}

// PUT /api/cart - Update item quantity
export async function PUT(req: NextRequest) {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const validation = UpdateCartItemQuantitySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'بيانات غير صالحة', errors: validation.error.errors }, { status: 400 });
        }
        const data = validation.data;
        // Update based on whether this is a variant or product update
        if ('variantId' in data) {
            await cartService.updateItemQuantity(userId, data.variantId, data.quantity);
        } else {
            await cartService.updateItemQuantity(userId, data.productId, data.quantity);
        }
        return NextResponse.json({ message: 'تم تحديث كمية المنتج' }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
    }
}

// DELETE /api/cart - Clear cart
export async function DELETE(req: NextRequest) {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
    }

    try {
        await cartService.clearUserCart(userId);
        return NextResponse.json({ message: 'تم تفريغ السلة' }, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
    }
}

// // DELETE /api/cart/item - Remove item from cart
// export async function DELETE_ITEM(req: NextRequest) {
//     const userId = await getUserIdFromSession(req);
//     if (!userId) {
//         return NextResponse.json({ message: 'المستخدم غير مصرح له' }, { status: 401 });
//     }

//     try {
//         const body = await req.json();
//         if (body) {
//             const validation = RemoveFromCartSchema.safeParse(body);
//             if (validation.success) {
//                 const data = validation.data;
//                 if ('variantId' in data) {
//                     await cartService.removeItemFromCart(userId, data.variantId);
//                 } else if ('productId' in data) {
//                     await cartService.removeItemFromCart(userId, data.productId);
//                 }
//                 return NextResponse.json({ message: 'تمت إزالة المنتج من السلة' }, { status: 200 });
//             }
//         }
//         return NextResponse.json({ message: 'بيانات غير صالحة' }, { status: 400 });
//     } catch (error) {
//         console.error(error);
//         return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
//     }
// }

// PATCH /api/cart - Update cart details
export async function PATCH(req: NextRequest) {
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
        return NextResponse.json({ message: 'تم تحديث تفاصيل السلة' }, { status: 200 });
    } catch (error) {
        console.error('Error updating cart details:', error);
        return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
    }
}
