import { Languages } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { currentLang, loadLang, localePath, saveLang, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * «English / العربية»: the same page in the other language. The choice is
 * remembered and wins over the device language on later visits.
 */
export function LanguageSwitch({ className, onSwitched }: { className?: string; onSwitched?: () => void }) {
  // react-router's own navigate: the address is already in the target language.
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()
  const other = currentLang() === 'en' ? 'ar' : 'en'

  return (
    <button
      type="button"
      lang={other}
      aria-label={t('common.switchLanguageLabel')}
      title={t('common.switchLanguageLabel')}
      onClick={async () => {
        saveLang(other)
        await loadLang(other)
        onSwitched?.()
        navigate(localePath(pathname, other) + search + hash)
      }}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      <Languages className="size-4 text-primary" aria-hidden="true" />
      <span>{t('common.switchLanguage')}</span>
    </button>
  )
}
