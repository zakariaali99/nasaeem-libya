/**
 * react-router's links, kept in the page's language: `<Link to="/cart">` on an
 * English page goes to `/en/cart`. Storefront code imports these instead of
 * react-router-dom's, so no address is ever written with the prefix by hand.
 */
import { useCallback } from 'react'
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  Navigate as RouterNavigate,
  useNavigate as useRouterNavigate,
  type LinkProps,
  type NavLinkProps,
  type NavigateOptions,
  type NavigateProps,
  type To,
} from 'react-router-dom'

import { localePath } from '@/lib/i18n'

export function localizeTo(to: To): To {
  if (typeof to === 'string') return localePath(to)
  return to.pathname ? { ...to, pathname: localePath(to.pathname) } : to
}

export function Link({ to, ...rest }: LinkProps) {
  return <RouterLink to={localizeTo(to)} {...rest} />
}

export function NavLink({ to, ...rest }: NavLinkProps) {
  return <RouterNavLink to={localizeTo(to)} {...rest} />
}

export function Navigate({ to, ...rest }: NavigateProps) {
  return <RouterNavigate to={localizeTo(to)} {...rest} />
}

export function useNavigate() {
  const navigate = useRouterNavigate()
  // Stable like react-router's own, so it is safe in effect dependencies.
  return useCallback(
    (to: To | number, options?: NavigateOptions) =>
      typeof to === 'number' ? navigate(to) : navigate(localizeTo(to), options),
    [navigate],
  )
}
