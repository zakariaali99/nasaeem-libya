import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Category, Collection, Product } from '@/types/api'

export interface PredictiveSearchData {
  trending_keywords: string[]
  matched_categories: Category[]
  matched_collections: Collection[]
  products: Product[]
}

export interface FragranceFinderRecommendation {
  product: Product
  match_score: number
  reason: string
  vibe_label: string
}

export interface FragranceFinderPayload {
  gender: string
  vibe: string
  occasion: string
  budget?: string
}

export function usePredictiveSearch(query: string) {
  return useQuery({
    queryKey: ['search', 'predictive', query],
    queryFn: async () => {
      const res = await api.get<PredictiveSearchData>(
        `/search/predictive/?q=${encodeURIComponent(query.trim())}`,
      )
      return res.data
    },
    enabled: true,
    staleTime: 30000,
  })
}

export function useFragranceFinder() {
  return useMutation({
    mutationFn: async (payload: FragranceFinderPayload) => {
      const res = await api.post<FragranceFinderRecommendation[]>(
        '/fragrance-finder/',
        payload,
      )
      return res.data
    },
  })
}
