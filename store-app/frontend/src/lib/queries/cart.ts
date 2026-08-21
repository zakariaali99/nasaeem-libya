import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { CartState, Order } from '@/types/api'

export const cartKeys = {
  cart: ['cart'] as const,
}

const EMPTY_CART: CartState = {
  id: null,
  items: [],
  item_count: 0,
  subtotal: '0.00',
  discount_total: '0.00',
  shipping_total: '0.00',
  total: '0.00',
  discount_code: '',
  discount_error: null,
  region_id: null,
}

/** The cart is public — a guest holds one, keyed on the session cookie. */
export function useCart() {
  return useQuery({
    queryKey: cartKeys.cart,
    queryFn: async () => (await api.get<CartState>('/cart/')).data,
    staleTime: 10_000,
  })
}

/**
 * Cart mutations are **optimistic**.
 *
 * On a slow Libyan mobile connection, waiting for a round trip before the
 * basket updates is the single biggest "feels broken" signal in the app. The
 * server's response replaces the guess on settle, and a failure rolls back to
 * the exact snapshot taken before the change.
 */
function useOptimisticCart<TInput>(
  mutationFn: (input: TInput) => Promise<{ data: CartState }>,
  optimistic: (cart: CartState, input: TInput) => CartState,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onMutate: async (input: TInput) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.cart })
      const previous = queryClient.getQueryData<CartState>(cartKeys.cart)
      if (previous) {
        queryClient.setQueryData<CartState>(cartKeys.cart, optimistic(previous, input))
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(cartKeys.cart, context.previous)
    },
    onSuccess: (response) => {
      // The server's numbers are the real ones — totals, stock ceilings and the
      // discount are all recomputed there.
      queryClient.setQueryData(cartKeys.cart, response.data)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.cart })
    },
  })
}

export interface AddToCartInput {
  product_id: string
  variant_id?: string | null
  quantity?: number
}

export function useAddToCart() {
  return useOptimisticCart<AddToCartInput>(
    (input) => api.post<CartState>('/cart/', input),
    (cart, input) => ({
      ...cart,
      // Only the count is guessed: a new line's price and line total are the
      // server's to compute, and inventing them here would be exactly the
      // client-side money the checkout refuses to trust.
      item_count: cart.item_count + (input.quantity ?? 1),
    }),
  )
}

export function useUpdateCartItem() {
  return useOptimisticCart<{ id: string; quantity: number }>(
    ({ id, quantity }) => api.patch<CartState>(`/cart/${id}/`, { quantity }),
    (cart, { id, quantity }) => {
      const items = cart.items.map((item) =>
        item.id === id ? { ...item, quantity } : item,
      )
      return {
        ...cart,
        items,
        item_count: items.reduce((sum, item) => sum + item.quantity, 0),
      }
    },
  )
}

export function useRemoveCartItem() {
  return useOptimisticCart<string>(
    (id) => api.delete<CartState>(`/cart/${id}/`),
    (cart, id) => {
      const items = cart.items.filter((item) => item.id !== id)
      return {
        ...cart,
        items,
        item_count: items.reduce((sum, item) => sum + item.quantity, 0),
      }
    },
  )
}

/** Discount validation is deliberately NOT optimistic: guessing whether a code
 * is valid, and by how much, is guessing about money. */
export function useApplyDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post<{ code: string; name: string; discount_total: string; cart: CartState }>(
        '/discounts/',
        { code },
      )).data,
    onSuccess: (data) => {
      queryClient.setQueryData(cartKeys.cart, data.cart)
    },
  })
}

export function useSaveCartDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (details: Record<string, string>) =>
      (await api.patch<{ cart: CartState }>('/cart/details/', details)).data,
    onSuccess: (data) => {
      if (data.cart) queryClient.setQueryData(cartKeys.cart, data.cart)
    },
  })
}

/** Creates the order from the cart. Auth is required here, and only here. */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Record<string, string> = {}) =>
      (await api.post<Order>('/cart/checkout/', input)).data,
    onSuccess: () => {
      queryClient.setQueryData(cartKeys.cart, EMPTY_CART)
      queryClient.invalidateQueries({ queryKey: cartKeys.cart })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useConfirmCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Record<string, string>) =>
      (await api.post<Order>('/checkout/', input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export { EMPTY_CART }
