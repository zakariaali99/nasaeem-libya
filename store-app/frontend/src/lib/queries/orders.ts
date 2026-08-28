import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Address, CartPromotion, CityAdmin, DashboardStats, Order } from '@/types/api'

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

export interface ShipmentResultData {
  success: boolean
  tracking_number: string | null
  message: string
  reused: boolean
}

/** Operator: create the courier shipment for an order. Idempotent server-side
 * — a second press returns the number already held unless `force`. */
export function useCreateShipment(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { force?: boolean } = {}) => {
      const response = await api.post<ShipmentResultData>(
        `/admin/orders/${orderId}/shipment/`,
        body,
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) })
    },
  })
}

export interface AdminPaymentRecord {
  id: string
  method_code: string
  status: string
  amount: string
  reference_id: string
  verified_at: string | null
  created_at: string
}

/** Operator: confirm a waiting-for-verification payment (manual transfer…).
 * Same funnel as a webhook — double-click credits once. */
export function useVerifyPayment(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await api.post<{ credited: boolean; message: string }>(
        `/admin/payments/${paymentId}/verify/`,
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useDashboardStats(
  paramsInput?: number | string | { days?: number | string; start_date?: string; end_date?: string },
) {
  const params =
    typeof paramsInput === 'object' && paramsInput !== null
      ? paramsInput
      : paramsInput !== undefined
      ? { days: paramsInput }
      : undefined

  return useQuery({
    queryKey: ['dashboard', params],
    queryFn: async () => {
      return (await api.get<DashboardStats>('/admin/dashboard/', { params })).data
    },
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

export function useActiveCartPromotion() {
  return useQuery({
    queryKey: ['cart-promotion-active'],
    queryFn: async () => (await api.get<CartPromotion | null>('/cart/promotions/active/')).data,
  })
}

export function useAdminCartPromotion() {
  return useQuery({
    queryKey: ['admin-cart-promotion'],
    queryFn: async () => (await api.get<CartPromotion>('/admin/cart-promotions/')).data,
  })
}

export function useUpdateAdminCartPromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<CartPromotion>) =>
      (await api.put<CartPromotion>('/admin/cart-promotions/', body)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-cart-promotion'], data)
      queryClient.invalidateQueries({ queryKey: ['cart-promotion-active'] })
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}

// --------------------------------------------------------------------------
// Plan 01 — Operational Velocity & Quick Order Entry Hooks
// --------------------------------------------------------------------------

export interface CustomerLookupResult {
  id: string
  name: string
  phone_number: string
  email: string
  last_city_id: string | null
  last_city_name: string
  last_region_id: string | null
  last_address: string
  orders_count: number
}

export function useCustomerLookup(phone: string) {
  return useQuery({
    queryKey: ['customer-lookup', phone],
    queryFn: async () => {
      if (!phone || phone.trim().length < 3) return []
      const res = await api.get<CustomerLookupResult[]>(
        `/admin/customers/lookup/?phone=${encodeURIComponent(phone.trim())}`,
      )
      return res.data
    },
    enabled: phone.trim().length >= 3,
    staleTime: 10_000,
  })
}

export interface QuickOrderItemInput {
  product_id: string
  variant_id?: string | null
  quantity: number
}

export interface QuickOrderPayload {
  customer_name: string
  customer_phone: string
  customer_email?: string
  shipping_city_id?: string | null
  shipping_region_id?: string | null
  shipping_address?: string
  delivery_method_code?: string
  payment_method_code?: string
  discount_code?: string
  customer_notes?: string
  items: QuickOrderItemInput[]
}

export function useQuickCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: QuickOrderPayload) => {
      const res = await api.post<Order>('/admin/orders/quick-create/', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })
}

export interface BulkOrderActionPayload {
  order_ids: string[]
  action: 'mark_processing' | 'mark_shipped' | 'mark_completed' | 'mark_cancelled'
  notes?: string
}

export interface BulkOrderActionResult {
  updated_count: number
  failed_ids: string[]
  message: string
}

export function useBulkOrderAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BulkOrderActionPayload) => {
      const res = await api.post<BulkOrderActionResult>('/admin/orders/bulk-action/', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export interface WaybillData {
  order_id: string
  order_number: string
  tracking_number: string
  barcode_value: string
  created_at: string
  recipient: {
    name: string
    phone_1: string
    phone_2?: string
    city: string
    region: string
    address: string
  }
  courier: {
    name: string
    code: string
  }
  payment: {
    method: string
    is_prepaid: boolean
    cod_amount: string
    total_amount: string
  }
  packing_list: {
    product_name: string
    variant_description: string
    quantity: number
    sku: string
  }[]
  fragile_warning: string
  customer_notes: string
}

export interface InvoiceData {
  invoice_number: string
  order_id: string
  order_number: string
  issue_date: string
  issue_time: string
  company: {
    name: string
    name_en: string
    cr_number: string
    city: string
    phone: string
    website: string
  }
  customer: {
    name: string
    phone: string
    email?: string
    city: string
    region: string
    address: string
  }
  items: {
    product_name: string
    variant_description: string
    sku: string
    quantity: number
    unit_price: string
    total_price: string
  }[]
  financials: {
    subtotal: string
    discount_total: string
    shipping_total: string
    delivery_discount_amount: string
    total: string
    tafqeet: string
    payment_method: string
    payment_status: string
  }
  verification_url: string
  terms: string
}

export function useOrderWaybill(lookup: string) {
  return useQuery({
    queryKey: ['order-waybill', lookup],
    queryFn: async () => {
      const res = await api.get<WaybillData>(`/admin/orders/${lookup}/waybill/`)
      return res.data
    },
    enabled: Boolean(lookup),
  })
}

export function useOrderInvoice(lookup: string) {
  return useQuery({
    queryKey: ['order-invoice', lookup],
    queryFn: async () => {
      const res = await api.get<InvoiceData>(`/admin/orders/${lookup}/invoice/`)
      return res.data
    },
    enabled: Boolean(lookup),
  })
}

export function useBatchWaybills(orderIds: string[]) {
  return useQuery({
    queryKey: ['batch-waybills', orderIds],
    queryFn: async () => {
      const res = await api.post<WaybillData[]>('/admin/orders/batch-waybills/', {
        order_ids: orderIds,
      })
      return res.data || []
    },
    enabled: orderIds.length > 0,
  })
}
