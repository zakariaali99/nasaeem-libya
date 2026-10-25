import { useEffect } from 'react'

import { isEnglish } from '@/lib/i18n'

const ARABIC_NAME = 'نسائم ليبيا'

/** Every route sets its own title and meta description. */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    const suffix = isEnglish() ? 'Nasaeem Libya' : ARABIC_NAME
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
  }, [title, description])
}
