import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { AbandonedCartsResponse } from '@/types/api'

export function useAbandonedCarts() {
  return useQuery({
    queryKey: ['admin-abandoned-carts'],
    queryFn: async () => {
      const res = await api.get<AbandonedCartsResponse>('/orders/admin/marketing/abandoned-carts/')
      return res.data
    },
  })
}

export function useSendAbandonedWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cartId: string) => {
      const res = await api.post<{ message: string; whatsapp_link: string; discount_code: string }>(
        `/orders/admin/marketing/abandoned-carts/${cartId}/send-whatsapp/`,
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
        `/orders/admin/marketing/abandoned-carts/${cartId}/mark-recovered/`,
        {},
      )
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-abandoned-carts'] })
    },
  })
}
