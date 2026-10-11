import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Widget } from '@/types/api'

export interface Layout {
  id: string
  name: string
  is_global_active: boolean
  /** The one layout the homepage is showing right now. */
  is_live: boolean
  has_schedule: boolean
  active_start_date: string | null
  active_end_date: string | null
  /** Lowercase English weekday names (`friday`), as the server stores them. */
  active_days: string[]
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
    mutationFn: async (body: LayoutDraft) => {
      const response = await api.patch<Layout>(`/admin/storefront-layouts/${id}/`, body)
      // The server words the outcome (live / switched on but not showing /
      // off), so the caller shows that instead of guessing.
      return { layout: response.data, message: response.message ?? 'تم الحفظ' }
    },
    onSuccess: ({ layout }) => {
      queryClient.setQueryData(customizationKeys.layout(id), layout)
      invalidate(queryClient)
    },
  })
}

export function useDuplicateLayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Layout>(`/admin/storefront-layouts/${id}/duplicate/`)).data,
    onSuccess: () => invalidate(queryClient),
  })
}

export function useDeleteLayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/storefront-layouts/${id}/`),
    onSuccess: () => invalidate(queryClient),
  })
}
