import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { usePageTitle } from './usePageTitle'

describe('usePageTitle', () => {
  it('sets document title and canonical link for Arabic default', () => {
    window.history.pushState({}, '', '/products')
    renderHook(() => usePageTitle('عطور رجالية'))

    expect(document.title).toBe('عطور رجالية — نسائم ليبيا')
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(canonical?.href).toBe('http://localhost:3000/products')

    const ogLocale = document.querySelector<HTMLMetaElement>('meta[property="og:locale"]')
    expect(ogLocale?.content).toBe('ar_LY')

    const hreflangAr = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="ar"]')
    const hreflangEn = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="en"]')
    const hreflangXDefault = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="x-default"]')

    expect(hreflangAr?.href).toBe('http://localhost:3000/products')
    expect(hreflangEn?.href).toBe('http://localhost:3000/en/products')
    expect(hreflangXDefault?.href).toBe('http://localhost:3000/products')
  })

  it('sets document title and canonical link for English route', () => {
    window.history.pushState({}, '', '/en/products')
    renderHook(() => usePageTitle('Men Perfumes'))

    expect(document.title).toBe('Men Perfumes — Nasaeem Libya')
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(canonical?.href).toBe('http://localhost:3000/en/products')

    const ogLocale = document.querySelector<HTMLMetaElement>('meta[property="og:locale"]')
    expect(ogLocale?.content).toBe('en_US')
  })
})
