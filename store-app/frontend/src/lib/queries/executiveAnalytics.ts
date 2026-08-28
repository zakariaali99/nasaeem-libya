import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ExecutiveAnalyticsData } from '@/types/api'

export function useExecutiveAnalytics(
  paramsInput?: number | string | { days?: number | string; start_date?: string; end_date?: string },
) {
  const params =
    typeof paramsInput === 'object' && paramsInput !== null
      ? paramsInput
      : paramsInput !== undefined
      ? { days: paramsInput }
      : undefined

  return useQuery({
    queryKey: ['executive-analytics', params],
    queryFn: async () => {
      const res = await api.get<ExecutiveAnalyticsData>('/admin/analytics/executive/', { params })
      return res.data
    },
    staleTime: 30_000,
  })
}

