import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ExecutiveAnalyticsData } from '@/types/api'

export function useExecutiveAnalytics() {
  return useQuery({
    queryKey: ['executive-analytics'],
    queryFn: async () => {
      const res = await api.get<ExecutiveAnalyticsData>('/admin/analytics/executive/')
      return res.data
    },
    staleTime: 60_000,
  })
}
