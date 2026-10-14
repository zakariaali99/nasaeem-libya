import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { authKeys } from '@/lib/queries/auth'
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

/** The most recent server-confirmed basket. Rollbacks restore this rather than
 * a per-mutation snapshot: a snapshot taken before another mutation settled
 * would resurrect state the server had already replaced. */
let lastConfirmedCart: CartState | null = null

/** The cart is public — a guest holds one, keyed on the session cookie. */
export function useCart() {
  return useQuery({
    queryKey: cartKeys.cart,
    queryFn: async () => {
      const cart = (await api.get<CartState>('/cart/')).data
      lastConfirmedCart = cart
      return cart
    },
    staleTime: 10_000,
  })
}

/**
 * Cart mutations are **optimistic**.
 *
 * On a slow Libyan mobile connection, waiting for a round trip before the
 * basket updates is the single biggest "feels broken" signal in the app. The
 * server's response replaces the guess on settle, and a failure rolls back to
 * the most recent **server-confirmed** basket, never to a snapshot another
 * in-flight or settled mutation may have already superseded.
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
      const restored = lastConfirmedCart ?? context?.previous
      if (restored) queryClient.setQueryData<CartState>(cartKeys.cart, restored)
    },
    onSuccess: (response) => {
      // The server's numbers are the real ones — totals, stock ceilings and the
      // discount are all recomputed there.
      lastConfirmedCart = response.data
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
      lastConfirmedCart = data.cart
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
      if (data.cart) {
        lastConfirmedCart = data.cart
        queryClient.setQueryData(cartKeys.cart, data.cart)
      }
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
      lastConfirmedCart = EMPTY_CART
      queryClient.setQueryData(cartKeys.cart, EMPTY_CART)
      queryClient.invalidateQueries({ queryKey: cartKeys.cart })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export interface CheckoutConfirmResult {
  order: Order
  whatsapp_link: string
  new_account_created: boolean
}

export function useConfirmCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Record<string, string>): Promise<CheckoutConfirmResult> => {
      // The WhatsApp link and the new-account flag sit beside `data`
      // in the response, not inside it; taking `.data` alone dropped them, and
      // the WhatsApp button on the thank-you page never appeared.
      const envelope = (await api.post<Order>('/checkout/', input)) as unknown as {
        data: Order
        whatsapp_link?: string
        new_account_created?: boolean
      }
      return {
        order: envelope.data,
        whatsapp_link: envelope.whatsapp_link ?? '',
        new_account_created: Boolean(envelope.new_account_created),
      }
    },
    onSuccess: async (result) => {
      // The thank-you page reads this same entry: without the update it showed
      // the draft as it was before confirmation, with no address on it.
      queryClient.setQueryData(['checkout-order', result.order.id], result.order)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['addresses'] })
      // A guest has just been given an account and signed in to it. Wait for
      // the app to learn that before moving on, so the next page greets a
      // signed-in customer instead of offering a login.
      await queryClient.invalidateQueries({ queryKey: authKeys.me })
    },
  })
}

/**
 * The order behind `/checkout/:orderId` and the thank-you page.
 *
 * Read through the checkout endpoint, which answers the session that created
 * the order — a guest has no account to be looked up by.
 */
export function useCheckoutOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['checkout-order', orderId ?? ''],
    queryFn: async () => (await api.get<Order>(`/checkout/${encodeURIComponent(orderId!)}/`)).data,
    enabled: Boolean(orderId),
  })
}

export { EMPTY_CART }
