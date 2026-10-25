import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/lib/theme'
import { t } from '@/lib/i18n'

/** The control that makes the `.dark` token layer reachable. Without one, every
 * `dark:` class in the app is dead code — which is what the reference shipped. */
export function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? t('theme.toDark') : t('theme.toLight')}
      title={next === 'dark' ? t('theme.dark') : t('theme.light')}
      className="inline-flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {resolved === 'dark' ? (
        <Sun className="size-5" aria-hidden="true" />
      ) : (
        <Moon className="size-5" aria-hidden="true" />
      )}
    </button>
  )
}
