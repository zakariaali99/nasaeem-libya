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

  const initialData = (() => {
    if (!recent && typeof window !== 'undefined') {
      const win = window as unknown as { __BOOTSTRAP__?: { layout?: StorefrontLayoutResponse } }
      if (win.__BOOTSTRAP__?.layout) {
        const layout = win.__BOOTSTRAP__.layout
        // Clear bootstrap layout after consuming so subsequent updates refetch fresh
        delete win.__BOOTSTRAP__.layout
        return layout
      }
    }
    return undefined
  })()

  return useQuery({
    queryKey: storefrontKeys.layout(recent),
    queryFn: async () =>
      (await api.get<StorefrontLayoutResponse>('/storefront/layout/', {
        params: { recent: recent || undefined },
      })).data,
    initialData,
    staleTime: 10 * 60_000,
  })
}
