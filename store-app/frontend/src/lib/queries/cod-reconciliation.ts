import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface CODReconciliationItemData {
  id: string
  order: string | null
  tracking_number: string
  order_number: string
  recipient_name: string
  expected_amount: string
  collected_amount: string
  delivery_fee: string
  discrepancy_amount: string
  match_status: 'matched' | 'amount_mismatch' | 'order_not_found' | 'already_settled'
  status_note: string
  is_approved: boolean
}

export interface CODReconciliationStatementData {
  id: string
  statement_id: string
  courier_code: string
  courier_name: string
  period_start: string | null
  period_end: string | null
  total_orders_count: number
  matched_orders_count: number
  discrepancies_count: number
  total_collected_expected: string
  total_collected_actual: string
  total_delivery_fees: string
  net_bank_deposit: string
  status: 'draft' | 'committed' | 'rejected'
  operator_name: string
  items?: CODReconciliationItemData[]
  created_at: string
  updated_at: string
}

export interface TrackingEventData {
  id: string
  courier_code: string
  status_code: string
  status_label_ar: string
  location: string
  driver_name: string
  driver_phone: string
  notes: string
  occurred_at: string
}

export interface OrderTrackingTimelineData {
  order_id: string
  order_number: string
  courier_name: string
  courier_code: string
  tracking_number: string
  tracking_url: string
  shipping_status: string
  current_status_label: string
  events: TrackingEventData[]
}

export interface WarehouseHubData {
  id: string
  code: string
  name_ar: string
  city_coverage: string[]
  address: string
  manager_phone: string
  is_active: boolean
}

export function useCODStatements() {
  return useQuery({
    queryKey: ['admin-cod-statements'],
    queryFn: async () => {
      const res = await api.get<CODReconciliationStatementData[]>('/admin/delivery/reconcile-statements/')
      return res.data || []
    },
  })
}

export function useCODStatementDetail(statementId: string) {
  return useQuery({
    queryKey: ['admin-cod-statement', statementId],
    queryFn: async () => {
      if (!statementId) return null
      const res = await api.get<CODReconciliationStatementData>(
        `/admin/delivery/reconcile-statements/${statementId}/`,
      )
      return res.data
    },
    enabled: Boolean(statementId),
  })
}

export function useUploadCODStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      courier_code: string
      courier_name: string
      raw_csv_text?: string
      rows?: Record<string, unknown>[]
    }) => {
      const res = await api.post<CODReconciliationStatementData>(
        '/admin/delivery/reconcile-statement/upload/',
        payload,
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cod-statements'] })
    },
  })
}

export function useCommitCODStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (statementId: string) => {
      const res = await api.post<CODReconciliationStatementData>(
        `/admin/delivery/reconcile-statements/${statementId}/commit/`,
        {},
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cod-statements'] })
      queryClient.invalidateQueries({ queryKey: ['admin-ledger-summary'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useOrderTrackingTimeline(lookup: string) {
  return useQuery({
    queryKey: ['order-tracking-timeline', lookup],
    queryFn: async () => {
      if (!lookup) return null
      const res = await api.get<OrderTrackingTimelineData>(
        `/admin/orders/${lookup}/tracking-timeline/`,
      )
      return res.data
    },
    enabled: Boolean(lookup),
  })
}

export function useWarehouseHubs() {
  return useQuery({
    queryKey: ['admin-warehouse-hubs'],
    queryFn: async () => {
      const res = await api.get<WarehouseHubData[]>('/admin/delivery/warehouse-hubs/')
      return res.data || []
    },
  })
}
