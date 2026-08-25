import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ExecutiveAnalyticsData } from '@/types/api'

export function useExecutiveAnalytics(days?: number | string) {
  return useQuery({
    queryKey: ['executive-analytics', days],
    queryFn: async () => {
      const params = days ? { days } : undefined
      const res = await api.get<ExecutiveAnalyticsData>('/admin/analytics/executive/', { params })
      return res.data
    },
    staleTime: 30_000,
  })
}

