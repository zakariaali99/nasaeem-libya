import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Widget } from '@/types/api'

export interface Layout {
  id: string
  name: string
  is_global_active: boolean
  active_start_date: string | null
  active_end_date: string | null
  active_days: number[]
  active_start_hour: number | null
  active_end_hour: number | null
  widgets: Widget[] & { targeting?: Record<string, unknown> | null }[]
  created_at: string
  updated_at: string
}

export type LayoutDraft = Partial<
  Pick<
    Layout,
    | 'name'
    | 'is_global_active'
    | 'active_start_date'
    | 'active_end_date'
    | 'active_days'
    | 'active_start_hour'
    | 'active_end_hour'
  >
> & {
  widgets?: {
    id?: string
    type: string
    data: Record<string, unknown>
    is_active: boolean
    targeting?: Record<string, unknown> | null
  }[]
}

export const customizationKeys = {
  layouts: ['layouts'] as const,
  layout: (id: string) => ['layouts', id] as const,
}

export function useLayouts() {
  return useQuery({
    queryKey: customizationKeys.layouts,
    queryFn: async () => (await api.get<Layout[]>('/admin/storefront-layouts/')).data,
  })
}

export function useLayout(id: string | undefined) {
  return useQuery({
    queryKey: customizationKeys.layout(id ?? ''),
    queryFn: async () => (await api.get<Layout>(`/admin/storefront-layouts/${id}/`)).data,
    enabled: Boolean(id),
  })
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: customizationKeys.layouts })
  queryClient.invalidateQueries({ queryKey: ['storefront-layout'] })
}

export function useCreateLayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.post<Layout>('/admin/storefront-layouts/', { name })).data,
    onSuccess: () => invalidate(queryClient),
  })
}

/** Saves scheduling fields and, when `widgets` is provided, the whole ordered list. */
export function useSaveLayout(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: LayoutDraft) =>
      (await api.patch<Layout>(`/admin/storefront-layouts/${id}/`, body)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(customizationKeys.layout(id), data)
      invalidate(queryClient)
    },
  })
}

export function useDeleteLayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/storefront-layouts/${id}/`),
    onSuccess: () => invalidate(queryClient),
  })
}
