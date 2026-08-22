import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/products', label: 'كل المنتجات' },
  { to: '/search', label: 'البحث' },
  { to: '/me/orders', label: 'طلباتي' },
  { to: '/developers/api', label: 'واجهة المطورين' },
]

export function Footer() {
  return (
    <footer className="mt-10 border-t border-border bg-muted/40">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <img src="/brand/logo.svg" alt="" width={32} height={32} className="size-8" />
            <span className="font-display text-lg font-bold tracking-wide">نسائم ليبيا</span>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            نسائم ليبيا لاستيراد العطور — مصراتة. بيع بالجملة والتجزئة، وتوصيل إلى جميع
            المدن الليبية.
          </p>
        </div>

        <nav aria-label="روابط سريعة">
          <h2 className="mb-2 text-base font-semibold">روابط سريعة</h2>
          <ul className="space-y-1">
            {LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  viewTransition
                  // min-w-11: a two-word Arabic link is only ~32 px wide, and
                  // the 44 px floor is a floor in both dimensions.
                  className="inline-flex h-11 min-w-11 items-center text-sm text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        جميع الحقوق محفوظة — نسائم ليبيا
      </div>
    </footer>
  )
}
