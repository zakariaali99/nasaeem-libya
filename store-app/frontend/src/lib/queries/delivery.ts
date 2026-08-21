import { useQuery } from '@tanstack/react-query'

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
