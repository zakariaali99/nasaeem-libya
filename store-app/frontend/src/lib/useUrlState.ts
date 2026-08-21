import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Filter, sort and page state lives in the URL so results are shareable and the
 * back button works. The reference kept it in component state, so refreshing a
 * filtered admin list silently reset it.
 */
export function useUrlState(defaults: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams()

  const get = useCallback(
    (key: string) => params.get(key) ?? defaults[key] ?? '',
    [params, defaults],
  )

  const set = useCallback(
    (updates: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(params)
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      // Any filter change returns to page 1 — staying on page 7 of a result set
      // that now has two pages shows an empty screen for no reason.
      if (!('page' in updates)) next.delete('page')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  return { get, set, params }
}
