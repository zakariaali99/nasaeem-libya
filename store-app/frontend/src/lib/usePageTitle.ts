import { useEffect } from 'react'

const SUFFIX = 'نسائم ليبيا'

/** Every route sets its own title and meta description. */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    // A product's own `meta_title` usually already ends in the store name, and
    // appending the suffix blindly produced
    // "Armaf Club de Nuit Intense | نسائم ليبيا | نسائم ليبيا".
    document.title = !title ? SUFFIX : title.includes(SUFFIX) ? title : `${title} | ${SUFFIX}`
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
