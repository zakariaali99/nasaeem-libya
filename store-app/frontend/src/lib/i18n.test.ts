import { afterEach, describe, expect, it } from 'vitest'

import { formatPrice } from '@/lib/format'
import { langOfPath, loadLang, localePath, stripLang, t, tCount } from '@/lib/i18n'
import ar from '@/locales/ar'
import en from '@/locales/en'

const goTo = (path: string) => window.history.replaceState(null, '', path)

afterEach(() => goTo('/'))

describe('addresses', () => {
  it('reads the language from the address', () => {
    expect(langOfPath('/en')).toBe('en')
    expect(langOfPath('/en/cart')).toBe('en')
    expect(langOfPath('/english-oud')).toBe('ar')
    expect(langOfPath('/products/x')).toBe('ar')
  })

  it('maps an address to the other language and back, keeping the query', () => {
    expect(localePath('/cart', 'en')).toBe('/en/cart')
    expect(localePath('/', 'en')).toBe('/en/')
    expect(localePath('/search?q=oud', 'en')).toBe('/en/search?q=oud')
    expect(localePath('/en/cart', 'en')).toBe('/en/cart')
    expect(localePath('/en/products/x', 'ar')).toBe('/products/x')
    expect(stripLang('/en')).toBe('/')
    expect(stripLang('/en?x=1')).toBe('/?x=1')
  })

  it('never translates the dashboard, the API or relative links', () => {
    expect(localePath('/admin/orders', 'en')).toBe('/admin/orders')
    expect(localePath('/api/products/', 'en')).toBe('/api/products/')
    expect(localePath('?page=2', 'en')).toBe('?page=2')
    expect(localePath('https://wa.me/218', 'en')).toBe('https://wa.me/218')
  })
})

describe('wording', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort())
  })

  it('speaks the language of the page', async () => {
    await loadLang('en')
    expect(t('cart.title')).toBe('سلة التسوق')
    goTo('/en/cart')
    expect(t('cart.title')).toBe('Shopping cart')
    expect(t('card.inCart', { n: 3 })).toBe('3 in cart')
    expect(formatPrice(10.5)).toBe('10.50 LYD')
  })

  it('picks the Arabic count form, and singular/plural in English', async () => {
    await loadLang('en')
    expect([1, 2, 3, 11].map((n) => tCount('cartPage.lines', n))).toEqual([
      'في سلتك صنف واحد',
      'في سلتك صنفان',
      'في سلتك 3 أصناف',
      'في سلتك 11 صنفاً',
    ])
    goTo('/en/cart')
    expect([1, 2].map((n) => tCount('cartPage.lines', n))).toEqual(['1 item in your cart', '2 items in your cart'])
  })
})
