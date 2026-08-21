import { NextApiRequest, NextApiResponse } from 'next';
import * as cartService from '../services/cartService';
import { AddToCartSchema, UpdateCartItemQuantitySchema, RemoveFromCartSchema, UpdateCartDetailsSchema } from '../types/cartTypes';
import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';

async function getUserIdFromSession(req: NextRequest): Promise<string | null> {
    const session = await auth.api.getSession(req);
    return session?.user.id || null;
}

async function withCartUser(req: NextRequest, res: NextApiResponse, handler: (userId: string) => Promise<void>) {
    const userId = await getUserIdFromSession(req);
    if (!userId) {
        return res.status(401).json({ message: 'المستخدم غير مصرح له' });
    }
    try {
        await handler(userId);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
}

export async function getCart(req: NextRequest, res: NextApiResponse) {
    await withCartUser(req, res, async (userId) => {
        const cart = await cartService.getCartContents(userId);
        res.status(200).json(cart);
    });
}

export async function addItem(req: NextRequest, res: NextApiResponse) {
    await withCartUser(req, res, async (userId) => {
        const body = await req.json();
        const validation = AddToCartSchema.safeParse(body);
        if (!validation.success) {
            return res.status(400).json({ message: 'بيانات غير صالحة', errors: validation.error.errors });
        }
        await cartService.addItemToCart(userId, validation.data);
        res.status(200).json({ message: 'تمت إضافة المنتج إلى السلة' });
    });
}

export async function updateItemQuantity(req: NextRequest, res: NextApiResponse) {
    await withCartUser(req, res, async (userId) => {
        const body = await req.json();
        const validation = UpdateCartItemQuantitySchema.safeParse(body);
        if (!validation.success) {
            return res.status(400).json({ message: 'بيانات غير صالحة', errors: validation.error.errors });
        }
        // Type-narrowing for data with variantId or productId
        const data = validation.data;
        const quantity = data.quantity;
        let id: string;
        if ('variantId' in data && data.variantId) {
            id = data.variantId;
        } else if ('productId' in data && data.productId) {
            id = data.productId;
        } else {
            throw new Error('بيانات تحديث السلة غير صالحة');
        }
        await cartService.updateItemQuantity(userId, id, quantity);
        res.status(200).json({ message: 'تم تحديث كمية المنتج' });
    });
}

export async function removeItem(req: NextRequest, res: NextApiResponse) {
    await withCartUser(req, res, async (userId) => {
        const body = await req.json();
        const validation = RemoveFromCartSchema.safeParse(body);
        if (!validation.success) {
            return res.status(400).json({ message: 'بيانات غير صالحة', errors: validation.error.errors });
        }
        // Type-narrowing for data with variantId or productId
        const data = validation.data;
        let idToRemove: string;
        if ('variantId' in data && data.variantId) {
            idToRemove = data.variantId;
        } else if ('productId' in data && data.productId) {
            idToRemove = data.productId;
        } else {
            throw new Error('بيانات إزالة من السلة غير صالحة');
        }
        await cartService.removeItemFromCart(userId, idToRemove);
        res.status(200).json({ message: 'تمت إزالة المنتج من السلة' });
    });
}

export async function clearCart(req: NextRequest, res: NextApiResponse) {
    await withCartUser(req, res, async (userId) => {
        await cartService.clearUserCart(userId);
        res.status(200).json({ message: 'تم تفريغ السلة' });
    });
}

export async function updateDetails(req: NextRequest, res: NextApiResponse) {
    await withCartUser(req, res, async (userId) => {
        const body = await req.json();
        const validation = UpdateCartDetailsSchema.safeParse(body);
        if (!validation.success) {
            return res.status(400).json({ message: 'بيانات غير صالحة', errors: validation.error.errors });
        }
        await cartService.updateCartDetails(userId, validation.data);
        res.status(200).json({ message: 'تم تحديث تفاصيل السلة' });
    });
}

export async function checkout(req: NextRequest, res: NextApiResponse) {
    await withCartUser(req, res, async (userId) => {
        // For now, just return the cart contents. 
        // In the future, this will trigger the order creation process.
        const cart = await cartService.getCartContents(userId);
        res.status(200).json(cart);
    });
}
