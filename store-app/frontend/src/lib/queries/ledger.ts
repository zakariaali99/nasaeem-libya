import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface LedgerSummary {
  pending_cod_courier: string
  pending_gateway_receivables: string
  bank_account_balance: string
  total_sales_revenue: string
  total_courier_expenses: string
  total_gateway_fees: string
  total_expenses: string
  net_profit: string
}

export interface LedgerEntryData {
  id: string
  account: string
  account_code: string
  account_name: string
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  entry_type: 'debit' | 'credit'
  amount: string
}

export interface LedgerTransactionData {
  id: string
  reference_type: string
  reference_id: string
  description: string
  entries: LedgerEntryData[]
  created_at: string
}

export interface SettleCourierPayload {
  courier_name: string
  collected_amount: string | number
  delivery_fee: string | number
  bank_deposit: string | number
  reference_id?: string
}

export interface ReconcileResult {
  checked_count: number
  reconciled_count: number
  failed_count: number
  skipped_count: number
  message: string
}

export interface RefundPayload {
  amount: string | number
  reason: string
}

export interface RefundResult {
  id: string
  payment: string
  order: string
  order_number: string
  amount: string
  reason: string
  provider_refund_id: string
  status: string
  operator_name: string
  created_at: string
}

export function useLedgerSummary() {
  return useQuery({
    queryKey: ['admin-ledger-summary'],
    queryFn: async () => {
      const res = await api.get<LedgerSummary>('/admin/ledger/summary/')
      return res.data
    },
  })
}

export function useLedgerTransactions() {
  return useQuery({
    queryKey: ['admin-ledger-transactions'],
    queryFn: async () => {
      const res = await api.get<LedgerTransactionData[]>('/admin/ledger/transactions/')
      return res.data || []
    },
  })
}

export function useSettleCourier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SettleCourierPayload) => {
      const res = await api.post<{ transaction_id: string }>('/admin/ledger/settle-courier/', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ledger-summary'] })
      queryClient.invalidateQueries({ queryKey: ['admin-ledger-transactions'] })
    },
  })
}

export function useReconcilePayments() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params?: { min_age?: number; max_age?: number }) => {
      const res = await api.post<ReconcileResult>('/admin/payments/reconcile/', params || {})
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-ledger-summary'] })
      queryClient.invalidateQueries({ queryKey: ['admin-ledger-transactions'] })
    },
  })
}

export function useProcessRefund(paymentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: RefundPayload) => {
      const res = await api.post<RefundResult>(`/admin/payments/${paymentId}/refund/`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['admin-ledger-summary'] })
      queryClient.invalidateQueries({ queryKey: ['admin-ledger-transactions'] })
    },
  })
}
