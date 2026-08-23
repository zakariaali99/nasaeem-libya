import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface PublicPaymentMethod {
  id: string
  method_code: string
  display_name: string
  description: string
  is_enabled: boolean
  sort_order: number
}

export interface AdminPaymentMethod {
  id: string
  method_code: string
  display_name: string
  description: string
  config_data: Record<string, any>
  is_enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PaymentInitiateResult {
  payment_id: string
  method_code: string
  action: 'redirect' | 'instructions' | 'confirm'
  gateway_url?: string
  redirect_url?: string
  instructions?: string
  qr_code?: string
  amount: string
  reference_id?: string
}

export interface PaymentRedirectData {
  success: boolean
  status: string
  order_status: string
  message: string
  order: any
}

export function usePublicPaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods', 'public'],
    queryFn: async () => {
      const response = await api.get<PublicPaymentMethod[]>('/payment_methods/')
      return response.data
    },
  })
}

export function useAdminPaymentMethods() {
  return useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: async () => {
      const response = await api.get<AdminPaymentMethod[]>('/admin/payment_methods/')
      return response.data
    },
  })
}

export function useAdminPaymentMethod(methodCode?: string) {
  return useQuery({
    queryKey: ['admin-payment-methods', methodCode],
    enabled: Boolean(methodCode),
    queryFn: async () => {
      const response = await api.get<AdminPaymentMethod>(`/admin/payment_methods/${methodCode}/`)
      return response.data
    },
  })
}

export function useUpdateAdminPaymentMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      methodCode,
      data,
    }: {
      methodCode: string
      data: Partial<AdminPaymentMethod>
    }) => {
      const response = await api.patch<AdminPaymentMethod>(
        `/admin/payment_methods/${methodCode}/`,
        data,
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] })
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods', variables.methodCode] })
      queryClient.invalidateQueries({ queryKey: ['payment-methods', 'public'] })
    },
  })
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: async ({
      order_id,
      method_code,
      user_input,
    }: {
      order_id: string
      method_code: string
      user_input?: Record<string, any>
    }) => {
      const response = await api.post<PaymentInitiateResult>('/payments/', {
        order_id,
        method_code,
        user_input,
      })
      return response.data
    },
  })
}

export function usePaymentRedirect(orderId?: string) {
  return useQuery({
    queryKey: ['payment-redirect', orderId],
    enabled: Boolean(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.order_status
      return status === 'pending' ? 2500 : false
    },
    queryFn: async () => {
      const response = await api.get<PaymentRedirectData>(`/payments/redirect/${orderId}/`)
      return response.data
    },
  })
}

export function useVerifyPayment(orderId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId }: { paymentId: string }) => {
      const response = await api.post<{
        success: boolean
        status: string
        message?: string
      }>(`/admin/payments/${paymentId}/verify/`)
      return response.data
    },
    onSuccess: () => {
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ['orders', orderId] })
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
