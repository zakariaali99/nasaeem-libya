/**
 * The storefront in two languages: Arabic at the existing addresses, English
 * at the same addresses under `/en/` (`/products/x` ↔ `/en/products/x`).
 *
 * The language is read from the address itself, so a plain function — `t()`,
 * `formatPrice()` — knows it without a React hook, and switching language is
 * just navigating to the other address (the two route trees are separate, so
 * every page re-renders in the new language).
 *
 * Arabic ships with the bundle. English is a separate file loaded once, before
 * the first English page renders (`loadLang`), so an Arabic visitor never
 * downloads it. The dashboard stays Arabic: `/admin` never takes the prefix.
 */
import ar from '@/locales/ar'

export type Lang = 'ar' | 'en'
export type MessageKey = keyof typeof ar
export type Messages = Record<MessageKey, string>

let en: Messages | null = null

export async function loadLang(lang: Lang): Promise<void> {
  if (lang === 'en' && !en) en = (await import('@/locales/en')).default
}

export function langOfPath(pathname: string): Lang {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ar'
}

export function currentLang(): Lang {
  return typeof window === 'undefined' ? 'ar' : langOfPath(window.location.pathname)
}

export const isEnglish = () => currentLang() === 'en'

/** Addresses that are never translated: the dashboard and server files. */
const UNTRANSLATED = /^\/(admin|api|media|django-admin)(\/|$|\?|#)/

/** `/en/cart?x=1` → `/cart?x=1`. */
export function stripLang(path: string): string {
  if (path === '/en') return '/'
  if (/^\/en[/?#]/.test(path)) {
    const rest = path.slice(3)
    return rest.startsWith('/') ? rest : `/${rest}`
  }
  return path
}

/** The same address in `lang` (the current page's language by default). */
export function localePath(path: string, lang: Lang = currentLang()): string {
  if (!path.startsWith('/') || path.startsWith('//') || UNTRANSLATED.test(path)) return path
  const bare = stripLang(path)
  return lang === 'ar' ? bare : `/en${bare}` // home is `/en/`
}

/** `t('cart.title')`, `t('cart.count', { n: 3 })` — `{name}` is filled from `vars`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let text = (currentLang() === 'en' && en ? en[key] : undefined) ?? ar[key] ?? key
  if (vars) text = text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole))
  return text
}

type CountKey = MessageKey extends infer K
  ? K extends `${infer Base}.one`
    ? Base
    : never
  : never

/**
 * A count with the right noun: «منتج واحد», «منتجان», «3 منتجات», «11 منتجاً»
 * in Arabic, "1 product" / "3 products" in English. Reads the keys
 * `<base>.one|two|few|many`, each with `{n}` where the number goes.
 */
export function tCount(base: CountKey, n: number, format: (n: number) => string = String): string {
  const form =
    currentLang() === 'en'
      ? n === 1
        ? 'one'
        : 'many'
      : n === 1
        ? 'one'
        : n === 2
          ? 'two'
          : n >= 3 && n <= 10
            ? 'few'
            : 'many'
  return t(`${base}.${form}` as MessageKey, { n: format(n) })
}

const LANG_KEY = 'store_lang'

/** The language the visitor picked with the switch, if any. */
export function savedLang(): Lang | null {
  try {
    const value = localStorage.getItem(LANG_KEY)
    return value === 'ar' || value === 'en' ? value : null
  } catch {
    return null
  }
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* private window: the choice lasts for this visit only */
  }
}

const CRAWLER = /bot|crawl|spider|slurp|lighthouse|headless|facebookexternalhit|whatsapp|telegram|preview/i

/**
 * Runs once, before the first render. A choice made with the switch always
 * wins. Without one, a visitor whose device is not in Arabic who lands on an
 * Arabic address is moved to the English one. Search engines are never moved,
 * so both languages get indexed.
 */
export function chooseEntryLanguage(): Lang {
  const { pathname, search, hash } = window.location
  const here = langOfPath(pathname)
  if (UNTRANSLATED.test(pathname) || CRAWLER.test(navigator.userAgent)) return here
  const device = (navigator.languages?.[0] ?? navigator.language ?? 'ar').toLowerCase()
  const want = savedLang() ?? (here === 'ar' && !device.startsWith('ar') ? 'en' : here)
  if (want !== here) window.history.replaceState(window.history.state, '', localePath(pathname, want) + search + hash)
  return want
}

/** `<html lang dir>` for the page being shown. */
export function applyDocumentLang(pathname: string): void {
  const lang = UNTRANSLATED.test(pathname) ? 'ar' : langOfPath(pathname)
  const root = document.documentElement
  root.lang = lang
  root.dir = lang === 'en' ? 'ltr' : 'rtl'
}
