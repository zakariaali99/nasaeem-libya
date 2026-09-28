import { useLayoutEffect } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'

/**
 * Every new page starts at the top. Without this the SPA keeps the previous
 * page's scroll offset, so opening a product from the bottom of a listing
 * landed mid-page.
 *
 * Keyed on the path only: filters and pagination change just the query string
 * and keep their own scrolling. Back/forward (POP) is left to the browser so
 * returning to a listing restores where the customer was.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navigationType])

  return null
}

/** Root route element: the scroll reset, then whichever layout matched. */
export function RootLayout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  )
}
