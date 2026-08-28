import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { LoyaltySummary } from '@/types/api'

export function useLoyaltySummary() {
  return useQuery({
    queryKey: ['loyalty-summary'],
    queryFn: async () => {
      const res = await api.get<LoyaltySummary>('/loyalty/me/')
      return res.data
    },
  })
}
