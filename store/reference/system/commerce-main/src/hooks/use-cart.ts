import { useCartContext } from '@/components/providers/CartProvider';

export function useCart() {
    const { cart } = useCartContext();
    return cart;
}

export function useCartActions() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cart, isLoading, ...actions } = useCartContext();
    return actions;
}
