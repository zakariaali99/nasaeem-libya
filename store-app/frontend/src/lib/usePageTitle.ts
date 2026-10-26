import { useEffect } from 'react'

import { isEnglish, localePath } from '@/lib/i18n'

const ARABIC_NAME = 'نسائم ليبيا'

function setLink(rel: string, href: string, extra?: Record<string, string>) {
  let selector = `link[rel="${rel}"]`
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      selector += `[${k}="${v}"]`
    }
  }
  let link = document.querySelector<HTMLLinkElement>(selector)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        link.setAttribute(k, v)
      }
    }
    document.head.appendChild(link)
  }
  link.href = href
}

function setMeta(property: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('property', property)
    document.head.appendChild(meta)
  }
  meta.content = content
}

/** Every route sets its own title, description, canonical and multilingual meta tags. */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    const english = isEnglish()
    const suffix = english ? 'Nasaeem Libya' : ARABIC_NAME
    // A product's own `meta_title` usually already ends in the store name, and
    // appending the suffix blindly produced
    // "Armaf Club de Nuit Intense | نسائم ليبيا | نسائم ليبيا".
    document.title = !title ? suffix : title.includes(suffix) || title.includes(ARABIC_NAME) ? title : `${title} — ${suffix}`
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (!tag) {
        tag = document.createElement('meta')
        tag.name = 'description'
        document.head.appendChild(tag)
      }
      tag.content = description
    }

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname
      const origin = window.location.origin
      const isDashboard = pathname.startsWith('/admin')

      // Canonical link per language
      const canonicalPath = localePath(pathname, english ? 'en' : 'ar')
      setLink('canonical', `${origin}${canonicalPath}`)

      // og:locale per language
      setMeta('og:locale', english ? 'en_US' : 'ar_LY')
      setMeta('og:locale:alternate', english ? 'ar_LY' : 'en_US')

      if (!isDashboard) {
        const arPath = localePath(pathname, 'ar')
        const enPath = localePath(pathname, 'en')
        setLink('alternate', `${origin}${arPath}`, { hreflang: 'ar' })
        setLink('alternate', `${origin}${enPath}`, { hreflang: 'en' })
        setLink('alternate', `${origin}${arPath}`, { hreflang: 'x-default' })
      }
    }
  }, [title, description])
}

