import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { ProductReviewsResponse, ProductReview } from '@/types/api'

export function useProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: async () => {
      const res = await api.get<ProductReviewsResponse>(`/products/${productId}/reviews/`)
      return res.data
    },
    enabled: Boolean(productId),
  })
}

export function useCreateProductReview(productId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      rating: number
      title: string
      comment: string
      photo_url?: string
    }) => {
      const res = await api.post<ProductReview>(
        `/products/${productId}/reviews/`,
        payload,
      )
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] })
      queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] })
    },
  })
}
