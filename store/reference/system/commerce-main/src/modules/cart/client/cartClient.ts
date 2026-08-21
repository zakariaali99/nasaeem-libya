"use client";

import { CartItem } from "@/modules/cache/cart";
import { AddToCartSchema, UpdateCartItemQuantitySchema, RemoveFromCartSchema, UpdateCartDetailsSchema } from "../types/cartTypes";
import { trackEvent } from "@/modules/analytics/client/analyticsClient";

export type DetailedCartItem = CartItem & {
    productName: string;
    variantTitle: string | null;
    price: number;
    imageUrl: string | null;
    lineItemTotal: number;
    discountAmount: number;
    discountId: string | null;
};

export interface DetailedCart {
    items: DetailedCartItem[];
    subtotal: number;
    total: number;
    deliveryFee: number;
    deliveryRegionId: string | null;
    deliveryCityId: string | null;
    notes: string | null;
    paymentMethod: string | null;
    address: string | null;
    discountTotal: number;
    deliveryDiscountAmount: number;
    discountApplications: Array<{ discount: any; discountAmount: number }>;
    useWallet: boolean;
    walletBalance: number;
    walletAmountUsed: number;
    payableTotal: number;
}

type CartListener = (cart: DetailedCart | null) => void;

class CartClient {
    private static instance: CartClient;
    private cart: DetailedCart | null = null;
    private listeners: Set<CartListener> = new Set();
    private initialized = false;

    private constructor() { }

    public static getInstance(): CartClient {
        if (!CartClient.instance) {
            CartClient.instance = new CartClient();
        }
        return CartClient.instance;
    }

    private notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.cart);
        }
    }

    public subscribe(listener: CartListener): () => void {
        this.listeners.add(listener);
        if (this.initialized) {
            listener(this.cart);
        }
        return () => {
            this.listeners.delete(listener);
        };
    }

    public async initializeCart() {
        if (this.initialized) return;
        try {
            await this.fetchCart();
        } catch (e) {
            console.warn("Cart initialization fetched failed silently", e);
        }
        this.initialized = true;
    }

    public getCart(): DetailedCart | null {
        return this.cart;
    }

    public async fetchCart(): Promise<void> {
        try {
            const response = await fetch('/api/cart');
            if (response.status === 401) {
                this.cart = null;
            } else if (response.ok) {
                this.cart = await response.json();
            } else {
                const errData = await response.json();
                console.error("Failed to fetch cart:", errData);
                throw new Error(errData?.message || response.statusText);
            }
        } catch (error: any) {
            console.error("Error fetching cart:", error);
            this.cart = null;
            throw error; // Propagate the error so the UI can catch it via an explicit API approach
        }
        this.notifyListeners();
    }

    public async addItem(item: { variantId?: string; productId?: string; quantity: number }): Promise<void> {
        const validation = AddToCartSchema.safeParse(item);
        if (!validation.success) {
            console.error("Invalid item data for adding to cart", validation.error);
            return;
        }

        try {
            const response = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validation.data),
            });
            if (response.ok) {
                trackEvent("add_to_cart", { ...validation.data });
                await this.fetchCart();
            } else {
                console.error("Failed to add item to cart:", response.statusText);
            }
        } catch (error) {
            console.error("Error adding item to cart:", error);
        }
    }

    public async updateItemQuantity(item: { variantId?: string; productId?: string; quantity: number }): Promise<void> {
        const validation = UpdateCartItemQuantitySchema.safeParse(item);
        if (!validation.success) {
            console.error("Invalid item data for updating cart", validation.error);
            return;
        }

        try {
            const response = await fetch('/api/cart', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validation.data),
            });
            if (response.ok) {
                trackEvent("update_cart", { ...validation.data });
                await this.fetchCart();
            } else {
                console.error("Failed to update item quantity:", response.statusText);
            }
        } catch (error) {
            console.error("Error updating item quantity:", error);
        }
    }

    public async removeItem(item: { variantId?: string; productId?: string }): Promise<void> {
        const validation = RemoveFromCartSchema.safeParse(item);
        if (!validation.success) {
            console.error("Invalid item data for removing from cart", validation.error);
            return;
        }
        // Determine the ID (variant or product) to remove using type guard
        const data = validation.data;
        let idToRemove: string;
        if ('variantId' in data) {
            idToRemove = data.variantId;
        } else {
            idToRemove = data.productId;
        }
        if (!idToRemove) return;
        try {
            const response = await fetch(`/api/cart/${idToRemove}`, { method: 'DELETE' });
            if (response.ok) {
                trackEvent("remove_from_cart", { ...validation.data });
                await this.fetchCart();
            } else {
                console.error("Failed to remove item from cart:", response.statusText);
            }
        } catch (error) {
            console.error("Error removing item from cart:", error);
        }
    }

    public async clearCart(): Promise<void> {
        try {
            const response = await fetch('/api/cart', {
                method: 'DELETE',
            });
            if (response.ok) {
                // Immediately update local state and notify listeners
                this.cart = null;
                this.notifyListeners();
                trackEvent("clear_cart");
                // Also fetch to ensure consistency
                await this.fetchCart();
            } else {
                console.error("Failed to clear cart:", response.statusText);
            }
        } catch (error) {
            console.error("Error clearing cart:", error);
        }
    }

    // Add method to update cart metadata (delivery region, notes, payment method)
    public async updateDetails(details: unknown): Promise<void> {
        const validation = UpdateCartDetailsSchema.safeParse(details);
        if (!validation.success) {
            console.error("Invalid cart details data", validation.error);
            return;
        }
        try {
            const response = await fetch('/api/cart', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validation.data),
            });
            if (response.ok) {
                trackEvent("update_cart_details", { ...validation.data });
                await this.fetchCart();
            } else {
                console.error("Failed to update cart details:", response.statusText);
            }
        } catch (error) {
            console.error("Error updating cart details:", error);
        }
    }

    // Create order from cart and return new orderId
    public async checkout(): Promise<string> {
        try {
            const response = await fetch('/api/cart/checkout', { method: 'POST' });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'فشل في إنشاء الطلب');
            }
            const data = await response.json();
            trackEvent("checkout", { step: "cart_checkout" });
            this.clearCart();
            this.notifyListeners();
            return data.orderNumber;
        } catch (error) {
            console.error('Error during checkout:', error);
            throw error;
        }
    }

    // Create order from cart and return new orderId (without clearing the cart)
    public async createOrder(): Promise<{ orderId: string; orderNumber: string; fullyPaid: boolean }> {
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
            });

            if (response.ok) {
                const result = await response.json();
                trackEvent("checkout", { step: "create_order" });
                return {
                    orderId: result.orderId,
                    orderNumber: result.orderNumber,
                    fullyPaid: result.fullyPaid
                };
            } else {
                const error = await response.json();
                throw new Error(error.message || 'حدث خطأ أثناء إنشاء الطلب');
            }
        } catch (error: any) {
            console.error("Error creating order:", error);
            throw error;
        }
    }

    // Initiate payment for an order
    public async initiatePayment(orderId: string, paymentMethod: string, userInput?: Record<string, any>): Promise<any> {
        try {
            const response = await fetch(`/api/checkout/${orderId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    paymentMethod,
                    userInput,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                trackEvent("checkout", { step: "initiate_payment", orderId, paymentMethod });
                return data;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'حدث خطأ أثناء بدء عملية الدفع');
            }
        } catch (error: any) {
            console.error("Error initiating payment:", error);
            throw error;
        }
    }

    // Verify payment status
    public async verifyPayment(paymentId: string, verificationData: Record<string, any> = {}): Promise<any> {
        try {
            const response = await fetch(`/api/checkout/verify?paymentId=${paymentId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(verificationData),
            });

            if (response.ok) {
                const result = await response.json();
                // Clear cart after successful payment verification regardless of result structure
                // The API should only return 200 if verification was successful
                await this.clearCart();
                trackEvent("checkout", { step: "verify_payment", paymentId, status: result.status });
                return result;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'حدث خطأ أثناء التحقق من الدفع');
            }
        } catch (error: any) {
            console.error("Error verifying payment:", error);
            throw error;
        }
    }
}

export const cartClient = CartClient.getInstance();
