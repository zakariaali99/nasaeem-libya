import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { recentlyViewed } from '@/lib/recentlyViewed'
import type { StorefrontLayoutResponse } from '@/types/api'

export const storefrontKeys = {
  layout: (recent: string) => ['storefront', 'layout', recent] as const,
}

/**
 * One request renders the homepage: the server resolves which layout is active
 * and returns its widgets with their products, categories and collections
 * already attached.
 */
export function useStorefrontLayout() {
  const recent = recentlyViewed().join(',')
  return useQuery({
    queryKey: storefrontKeys.layout(recent),
    queryFn: async () =>
      (await api.get<StorefrontLayoutResponse>('/storefront/layout/', {
        params: { recent: recent || undefined },
      })).data,
    staleTime: 60_000,
  })
}
