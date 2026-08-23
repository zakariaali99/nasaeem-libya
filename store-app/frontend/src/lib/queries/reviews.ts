import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { ProductReviewsResponse, ProductReview } from '@/types/api'

export function useProductReviews(slug: string) {
  return useQuery({
    queryKey: ['product-reviews', slug],
    queryFn: async () => {
      const res = await api.get<ProductReviewsResponse>(`/catalog/products/${slug}/reviews/`)
      return res.data
    },
    enabled: Boolean(slug),
  })
}

export function useCreateProductReview(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      rating: number
      title: string
      comment: string
      photo_url?: string
    }) => {
      const res = await api.post<ProductReview>(
        `/catalog/products/${slug}/reviews/`,
        payload,
      )
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews', slug] })
      queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] })
    },
  })
}
