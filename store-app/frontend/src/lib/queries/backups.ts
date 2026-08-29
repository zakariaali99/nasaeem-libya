import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface BackupStats {
  products_count: number
  images_count: number
  orders_count: number
  users_count: number
  categories_count: number
  reviews_count: number
  layouts_count: number
  widgets_count: number
  media_size_bytes: number
  media_size_mb: number
}

export interface BackupItem {
  filename: string
  size_bytes: number
  size_mb: number
  created_at: string
  manifest?: {
    version?: string
    app?: string
    timestamp?: string
    stats?: BackupStats
    models_included?: string[]
  }
}

export interface BackupsResponse {
  stats: BackupStats
  backups: BackupItem[]
}

export const backupKeys = {
  all: ['admin', 'backups'] as const,
}

export function useBackups() {
  return useQuery({
    queryKey: backupKeys.all,
    queryFn: async () => (await api.get<BackupsResponse>('/admin/backups/')).data,
  })
}

export function useCreateBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post<BackupItem>('/admin/backups/export/')).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupKeys.all })
    },
  })
}

export function useDeleteBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (filename: string) =>
      (await api.delete<{ deleted: boolean }>(`/admin/backups/${encodeURIComponent(filename)}/`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupKeys.all })
    },
  })
}

export function useRestoreBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ filename, file }: { filename?: string; file?: File }) => {
      if (file) {
        const formData = new FormData()
        formData.append('file', file)
        return (await api.post<{ success: boolean; restored_records_count: number }>('/admin/backups/restore/', formData)).data
      }
      return (await api.post<{ success: boolean; restored_records_count: number }>('/admin/backups/restore/', { filename })).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}
