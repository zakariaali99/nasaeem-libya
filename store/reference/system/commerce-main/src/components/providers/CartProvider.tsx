'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { cartClient, DetailedCart } from '@/modules/cart/client/cartClient';

interface CartContextType {
    cart: DetailedCart | null;
    isLoading: boolean;
    addItem: typeof cartClient.addItem;
    removeItem: typeof cartClient.removeItem;
    updateItemQuantity: typeof cartClient.updateItemQuantity;
    clearCart: typeof cartClient.clearCart;
    updateDetails: typeof cartClient.updateDetails;
    checkout: typeof cartClient.checkout;
    createOrder: typeof cartClient.createOrder;
    initiatePayment: typeof cartClient.initiatePayment;
    verifyPayment: typeof cartClient.verifyPayment;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<DetailedCart | null>(cartClient.getCart());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initial fetch
        const init = async () => {
            try {
                await cartClient.initializeCart();
            } finally {
                setIsLoading(false);
            }
        };
        init();

        // Subscribe to updates
        const unsubscribe = cartClient.subscribe((newCart) => {
            setCart(newCart);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const value = useMemo(() => ({
        cart,
        isLoading,
        addItem: cartClient.addItem.bind(cartClient),
        removeItem: cartClient.removeItem.bind(cartClient),
        updateItemQuantity: cartClient.updateItemQuantity.bind(cartClient),
        clearCart: cartClient.clearCart.bind(cartClient),
        updateDetails: cartClient.updateDetails.bind(cartClient),
        checkout: cartClient.checkout.bind(cartClient),
        createOrder: cartClient.createOrder.bind(cartClient),
        initiatePayment: cartClient.initiatePayment.bind(cartClient),
        verifyPayment: cartClient.verifyPayment.bind(cartClient),
    }), [cart, isLoading]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
}

export function useCartContext() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCartContext must be used within a CartProvider');
    }
    return context;
}
