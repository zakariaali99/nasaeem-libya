import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AbandonedCartsResponse } from '@/types/api'

export interface AbandonedCartsParams {
  minutes?: number
  status?: 'all' | 'pending' | 'reminded' | 'recovered'
  q?: string
}

export function useAbandonedCarts(params?: AbandonedCartsParams) {
  return useQuery({
    queryKey: ['admin-abandoned-carts', params],
    queryFn: async () => {
      const res = await api.get<AbandonedCartsResponse>('/admin/marketing/abandoned-carts/', {
        params: params as Record<string, string | number | boolean | undefined | null>,
      })
      return res.data
    },
  })
}

export function useSendAbandonedWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cartId: string) => {
      const res = await api.post<{ message: string; whatsapp_link: string; discount_code: string }>(
        `/admin/marketing/abandoned-carts/${cartId}/send-whatsapp/`,
        {},
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-abandoned-carts'] })
    },
  })
}

export function useMarkCartRecovered() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cartId: string) => {
      const res = await api.post<{ message: string }>(
        `/admin/marketing/abandoned-carts/${cartId}/mark-recovered/`,
        {},
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-abandoned-carts'] })
    },
  })
}
