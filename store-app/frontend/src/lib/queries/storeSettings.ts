import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface BankAccountItem {
  id: string
  bank_name: string
  branch?: string
  account_holder: string
  account_number: string
  iban?: string
  is_active?: boolean
  sort_order?: number
}

export interface StoreSettingsData {
  store_name: string
  legal_name: string
  legal_name_en: string
  cr_number: string
  address: string
  site_url: string
  phone: string
  whatsapp: string
  email: string
  bank_transfer_note: string
  bank_accounts?: BankAccountItem[]
  updated_at?: string
}

declare global {
  interface Window {
    __STORE_SETTINGS__?: StoreSettingsData
  }
}

export function useStoreSettings() {
  return useQuery({
    queryKey: ['store-settings'],
    queryFn: async () => (await api.get<StoreSettingsData>('/store-settings/')).data,
    initialData: typeof window !== 'undefined' ? window.__STORE_SETTINGS__ : undefined,
    staleTime: 10 * 60_000,
  })
}

export function useAdminStoreSettings() {
  return useQuery({
    queryKey: ['admin-store-settings'],
    queryFn: async () => (await api.get<StoreSettingsData>('/admin/store-settings/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateStoreSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<StoreSettingsData>) => {
      const res = await api.put<StoreSettingsData>('/admin/store-settings/', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-store-settings'] })
    },
  })
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ['admin-bank-accounts'],
    queryFn: async () => (await api.get<BankAccountItem[]>('/admin/bank-accounts/')).data,
  })
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<BankAccountItem, 'id'>) => {
      const res = await api.post<BankAccountItem>('/admin/bank-accounts/', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-bank-accounts'] })
    },
  })
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BankAccountItem> & { id: string }) => {
      const res = await api.patch<BankAccountItem>(`/admin/bank-accounts/${id}/`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-bank-accounts'] })
    },
  })
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/bank-accounts/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-bank-accounts'] })
    },
  })
}
