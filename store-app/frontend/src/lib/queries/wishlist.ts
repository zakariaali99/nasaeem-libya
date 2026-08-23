import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Product } from '@/types/api'

export interface WishlistItemShape {
  id: string
  product: Product
  created_at: string
}

export const wishlistKeys = {
  all: ['wishlist'] as const,
  ids: ['wishlist', 'ids'] as const,
}

export function useWishlist() {
  return useQuery({
    queryKey: wishlistKeys.all,
    queryFn: async () => {
      const res = await api.get<WishlistItemShape[]>('/wishlist/')
      return res.data ?? []
    },
    staleTime: 30_000,
  })
}

export function useWishlistIds() {
  return useQuery({
    queryKey: wishlistKeys.ids,
    queryFn: async () => {
      try {
        const res = await api.get<string[]>('/wishlist/ids/')
        return res.data ?? []
      } catch {
        return []
      }
    },
    staleTime: 30_000,
  })
}

export function useToggleWishlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (productId: string) => {
      const res = await api.post<{ is_wishlisted: boolean; count: number; product_id: string }>(
        '/wishlist/toggle/',
        { product_id: productId },
      )
      return res.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData<string[]>(wishlistKeys.ids, (old = []) => {
        if (data.is_wishlisted) {
          return [...old, data.product_id]
        }
        return old.filter((id) => id !== data.product_id)
      })
      queryClient.invalidateQueries({ queryKey: wishlistKeys.all })
    },
  })
}
