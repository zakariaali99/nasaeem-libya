import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { User } from '@/types/api'

export interface CreateStaffInput {
  name: string
  phone_number: string
  email?: string
  role: 'admin' | 'manager' | 'staff' | 'support'
  password: string
}

export interface UpdateStaffInput {
  name?: string
  email?: string
  role?: 'admin' | 'manager' | 'staff' | 'support'
  is_active?: boolean
  password?: string
}

export interface StaffListResponse {
  items: User[]
  total: number
}

export const staffKeys = {
  all: ['admin', 'staff'] as const,
  list: (filter?: { search?: string; role?: string }) => ['admin', 'staff', filter] as const,
}

export function useStaffList(filter?: { search?: string; role?: string }) {
  return useQuery({
    queryKey: staffKeys.list(filter),
    queryFn: async () =>
      (await api.get<StaffListResponse>('/admin/staff/', { params: filter })).data,
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateStaffInput) =>
      (await api.post<User>('/admin/staff/', input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.all })
    },
  })
}

export function useUpdateStaff(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: UpdateStaffInput) =>
      (await api.patch<User>(`/admin/staff/${userId}/`, patch)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.all })
    },
  })
}

export function useDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.delete<{ deleted: boolean; message: string }>(`/admin/staff/${userId}/`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.all })
    },
  })
}
