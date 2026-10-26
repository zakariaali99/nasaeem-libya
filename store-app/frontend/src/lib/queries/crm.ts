import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { OrderStage } from '@/types/api'

/**
 * The customer file (CRM). Every number here is computed by the server from
 * the orders when asked — nothing is stored but what staff type (tags, the
 * birthday, the contact log).
 */

export type Segment = 'inactive' | 'vip' | 'repeat' | 'new'

export const SEGMENT_LABELS: Record<Segment, string> = {
  inactive: 'خامل',
  vip: 'VIP',
  repeat: 'متكرر',
  new: 'جديد',
}

export const SEGMENT_TONES: Record<Segment, 'neutral' | 'gold' | 'success' | 'info'> = {
  inactive: 'neutral',
  vip: 'gold',
  repeat: 'success',
  new: 'info',
}

export interface CustomerTag {
  id: string
  name: string
  color: string
}

export type InteractionKind = 'call' | 'whatsapp' | 'complaint' | 'followup' | 'note'

export const INTERACTION_KINDS: { value: InteractionKind; label: string }[] = [
  { value: 'call', label: 'مكالمة' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'complaint', label: 'شكوى' },
  { value: 'followup', label: 'متابعة' },
  { value: 'note', label: 'ملاحظة' },
]

export interface CustomerInteraction {
  id: string
  kind: InteractionKind
  kind_label: string
  text: string
  staff_name: string
  created_at: string
}

export interface CustomerRow {
  id: string
  name: string
  phone_number: string
  email: string | null
  role: string
  is_active: boolean
  date_joined: string
  birthday: string | null
  birthday_today: boolean
  city: string
  orders_count: number
  spend: string
  last_order_at: string | null
  segment: Segment
  tags: CustomerTag[]
}

export interface CustomerProfile extends CustomerRow {
  average_order: string
  favourite_city: string
  recent_orders: { id: string; order_number: string; stage: OrderStage; total: string; created_at: string }[]
  interactions: CustomerInteraction[]
  whatsapp_number: string
  templates: { key: TemplateKey; label: string; text: string }[]
  coupons: { code: string; name: string }[]
  can_export: boolean
  can_delete_interactions: boolean
}

export type TemplateKey = 'followup' | 'vip' | 'birthday'

export interface BirthdayRow {
  id: string
  name: string
  phone_number: string
  birthday: string
  today: boolean
}

export type CustomerListParams = Record<string, string | number | undefined>

export const crmKeys = {
  list: (params: CustomerListParams) => ['crm', 'customers', params] as const,
  profile: (id: string) => ['crm', 'customer', id] as const,
  tags: ['crm', 'tags'] as const,
  birthdays: ['crm', 'birthdays'] as const,
}

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: crmKeys.list(params),
    queryFn: async () => {
      const response = await api.get<CustomerRow[]>('/admin/customers/', { params })
      return { items: response.data, meta: response.meta ?? { page: 1, limit: 20, total: 0, pages: 1 } }
    },
    placeholderData: (previous) => previous,
  })
}

export function useCustomerProfile(id: string | null | undefined) {
  return useQuery({
    queryKey: crmKeys.profile(id ?? ''),
    queryFn: async () => (await api.get<CustomerProfile>(`/admin/customers/${id}/`)).data,
    enabled: Boolean(id),
  })
}

export function useBirthdays() {
  return useQuery({
    queryKey: crmKeys.birthdays,
    queryFn: async () => (await api.get<BirthdayRow[]>('/admin/customers/birthdays/')).data,
    staleTime: 10 * 60_000,
  })
}

export function useCustomerTags() {
  return useQuery({
    queryKey: crmKeys.tags,
    queryFn: async () => (await api.get<CustomerTag[]>('/admin/customer-tags/')).data,
    staleTime: 5 * 60_000,
  })
}

function invalidateCustomer(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: crmKeys.profile(id) })
  queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] })
  queryClient.invalidateQueries({ queryKey: ['admin-user', id] })
}

export function useCreateCustomerTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; color: string }) =>
      (await api.post<CustomerTag>('/admin/customer-tags/', data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: crmKeys.tags }),
  })
}

export function useDeleteCustomerTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/customer-tags/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.tags })
      queryClient.invalidateQueries({ queryKey: ['crm'] })
    },
  })
}

/** Birthday and tags live on the user row, through the existing admin PATCH. */
export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { birthday?: string | null; tags?: string[] }) =>
      (await api.patch(`/admin/users/${id}/`, data)).data,
    onSuccess: () => {
      invalidateCustomer(queryClient, id)
      queryClient.invalidateQueries({ queryKey: crmKeys.birthdays })
    },
  })
}

export function useAddInteraction(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { kind: InteractionKind; text: string }) =>
      (await api.post<CustomerInteraction>(`/admin/customers/${id}/interactions/`, data)).data,
    onSuccess: () => invalidateCustomer(queryClient, id),
  })
}

export function useDeleteInteraction(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (interactionId: string) => {
      await api.delete(`/admin/customers/${id}/interactions/${interactionId}/`)
    },
    onSuccess: () => invalidateCustomer(queryClient, id),
  })
}

/** Asks the server for the wa.me link of a template (it logs the message), then opens it. */
export function useWhatsAppTemplate(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { template: TemplateKey; coupon?: string; order?: string }) =>
      (await api.post<{ url: string; text: string }>(`/admin/customers/${id}/whatsapp/`, data)).data,
    onSuccess: (data) => {
      window.open(data.url, '_blank', 'noopener,noreferrer')
      invalidateCustomer(queryClient, id)
    },
  })
}

/** The export is a plain link under /api/, so the browser downloads the file itself. */
export function customersExportUrl(params: CustomerListParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && key !== 'page' && key !== 'limit') search.set(key, String(value))
  }
  const qs = search.toString()
  return `/api/admin/customers/export.csv${qs ? `?${qs}` : ''}`
}
