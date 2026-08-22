import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Address, CityAdmin, DashboardStats, Order } from '@/types/api'

export const orderKeys = {
  list: (params?: Record<string, unknown>) => ['orders', params ?? {}] as const,
  detail: (lookup: string) => ['orders', 'detail', lookup] as const,
}

type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface Paginated<T> {
  items: T[]
  meta: { page: number; limit: number; total: number; pages: number }
}

export function useMyOrders(params: QueryParams = {}) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: async (): Promise<Paginated<Order>> => {
      // A paginated response's envelope IS `{data, meta}` — meta lives beside
      // the data on the envelope, not inside it.
      const response = await api.get<Order[]>('/orders/', { params })
      return {
        items: response.data,
        meta: response.meta ?? { page: 1, limit: 20, total: 0, pages: 1 },
      }
    },
    placeholderData: (previous) => previous,
  })
}

export function useOrder(lookup: string | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(lookup ?? ''),
    queryFn: async () => (await api.get<Order>(`/orders/${lookup}/`)).data,
    enabled: Boolean(lookup),
  })
}

export function useUpdateOrder(lookup?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, string>) =>
      (await api.patch<Order>(`/orders/${lookup}/`, body)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(orderKeys.detail(lookup ?? ''), data)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardStats>('/admin/dashboard/')).data,
  })
}

export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get<Address[]>('/me/addresses/')).data,
  })
}export function useSaveAddress(id?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      id ? api.patch(`/me/addresses/${id}/`, body) : api.post('/me/addresses/', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function useDeleteAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/me/addresses/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function useCitiesAdmin() {
  return useQuery({
    queryKey: ['cities-admin'],
    queryFn: async () => (await api.get<CityAdmin[]>('/admin/cities/')).data,
  })
}

export function useUpdateCity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; delivery_fee?: string; is_active?: boolean }) =>
      api.patch(`/admin/cities/${id}/`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities-admin'] }),
  })
}

export function useUpdateRegion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; delivery_fee?: string; is_active?: boolean }) =>
      api.patch(`/admin/regions/${id}/`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities-admin'] }),
  })
}
