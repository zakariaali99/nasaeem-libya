import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { City, DeliveryMethod, DeliveryRegion, Order } from '@/types/api'

export const deliveryKeys = {
  cities: ['delivery', 'cities'] as const,
  regions: (cityId: string) => ['delivery', 'regions', cityId] as const,
  methods: ['delivery', 'methods'] as const,
  order: (id: string) => ['orders', id] as const,
  orders: (params: Record<string, unknown>) => ['orders', params] as const,
}

/**
 * The cities endpoint returns an Arabic `message` when the list is empty, and
 * that message is carried through rather than dropped — the reference rendered
 * an empty `<select>` with no explanation and the customer could not order.
 */
export function useCities() {
  return useQuery({
    queryKey: deliveryKeys.cities,
    queryFn: async () => {
      const response = await api.get<City[]>('/delivery/cities/')
      return { cities: response.data, message: response.message ?? null }
    },
    staleTime: 5 * 60_000,
  })
}

export function useRegions(cityId: string | undefined) {
  return useQuery({
    queryKey: deliveryKeys.regions(cityId ?? ''),
    queryFn: async () => {
      const response = await api.get<DeliveryRegion[]>(
        `/delivery/cities/${encodeURIComponent(cityId!)}/regions/`,
      )
      return { regions: response.data, message: response.message ?? null }
    },
    enabled: Boolean(cityId),
    staleTime: 5 * 60_000,
  })
}

export function useDeliveryMethods() {
  return useQuery({
    queryKey: deliveryKeys.methods,
    queryFn: async () => (await api.get<DeliveryMethod[]>('/delivery/methods/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useOrder(lookup: string | undefined) {
  return useQuery({
    queryKey: deliveryKeys.order(lookup ?? ''),
    queryFn: async () => (await api.get<Order>(`/orders/${encodeURIComponent(lookup!)}/`)).data,
    enabled: Boolean(lookup),
  })
}

export function useOrders(params: Record<string, string | number> = {}) {
  return useQuery({
    queryKey: deliveryKeys.orders(params),
    queryFn: async () => {
      const response = await api.get<Order[]>('/orders/', { params })
      return { items: response.data, meta: response.meta }
    },
  })
}

export interface AdminDeliveryMethod {
  id: string
  name: string
  code: string
  description: string
  is_active: boolean
  configuration: Record<string, any>
  created_at: string
  updated_at: string
}

export function useAdminDeliveryMethods() {
  return useQuery({
    queryKey: ['admin-delivery-methods'],
    queryFn: async () => {
      const response = await api.get<AdminDeliveryMethod[]>('/admin/delivery/methods/')
      return response.data
    },
  })
}

export function useAdminDeliveryMethod(code?: string) {
  return useQuery({
    queryKey: ['admin-delivery-methods', code],
    enabled: Boolean(code),
    queryFn: async () => {
      const response = await api.get<AdminDeliveryMethod>(`/admin/delivery/methods/${code}/`)
      return response.data
    },
  })
}

export function useUpdateAdminDeliveryMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      code,
      data,
    }: {
      code: string
      data: Partial<AdminDeliveryMethod>
    }) => {
      const response = await api.patch<AdminDeliveryMethod>(
        `/admin/delivery/methods/${code}/`,
        data,
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-methods'] })
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-methods', variables.code] })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.methods })
    },
  })
}

export function useSyncDeliveryMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await api.post<{ synced_cities: number; synced_regions: number }>(
        `/admin/delivery/sync/${code}/`,
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.cities })
    },
  })
}

export function useCreateShipment(orderId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}) => {
      const response = await api.post<{
        success: boolean
        tracking_number: string
        tracking_url: string
        courier_code: string
        message?: string
      }>(`/admin/orders/${orderId}/shipment/`, { force })
      return response.data
    },
    onSuccess: () => {
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: deliveryKeys.order(orderId) })
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

