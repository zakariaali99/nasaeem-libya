import {
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useStoreSettings } from '@/lib/queries/storeSettings'
import { formatLibyanPhone } from '@/lib/format'
import { useSiteText } from '@/lib/siteText'

const STORE_LINKS = [
  { to: '/products', label: 'كل العطور والمنتجات' },
  { to: '/wishlist', label: 'قائمة المفضلة' },
  { to: '/search', label: 'البحث المتقدم' },
  { to: '/cart', label: 'سلة المشتريات' },
]

const ACCOUNT_LINKS = [
  { to: '/me/orders', label: 'تتبع طلباتي السابقة' },
  { to: '/me/addresses', label: 'عناويني المحفوظة' },
  { to: '/me', label: 'الملف الشخصي' },
]

const TRUST_ICONS = [Sparkles, Truck, ShieldCheck]

export function Footer() {
  const currentYear = new Date().getFullYear()
  const { data: settings } = useStoreSettings()

  const storeName = settings?.store_name || 'نسائم ليبيا'
  const storeAddress = settings?.address || ''
  const phone = settings?.phone || ''
  const legalName = settings?.legal_name || 'نسائم ليبيا'
  const t = useSiteText()
  // Wording comes from the dashboard; a line left empty there is not drawn.
  const trust = [1, 2, 3]
    .map((n, index) => ({
      icon: TRUST_ICONS[index]!,
      title: t(`footer.trust.${n}.title`),
      description: t(`footer.trust.${n}.text`),
    }))
    .filter((badge) => badge.title)

  return (
    <footer className="mt-8 sm:mt-16 border-t border-border bg-card/60 backdrop-blur-sm">
      {/* Trust Badges Strip */}
      {trust.length > 0 && (
        <div className="border-b border-border/80 bg-muted/20">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3">
            {trust.map((badge, idx) => {
              const Icon = badge.icon
              return (
                <div key={idx} className="flex items-center gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">{badge.title}</h4>
                    {badge.description && <p className="text-[11px] text-muted-foreground mt-0.5">{badge.description}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main 3-Column Footer */}
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 md:grid-cols-3">
        {/* Brand info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <img src="/brand/logo.svg" alt="" width={24} height={24} className="size-6" />
            </div>
            <span className="font-display text-xl font-bold tracking-wide text-foreground">{storeName}</span>
          </div>
          {t('footer.about') && (
            <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">{t('footer.about')}</p>
          )}
          <div className="space-y-1.5 pt-2 text-xs text-muted-foreground">
            {storeAddress && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary shrink-0" />
                <span>{storeAddress}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-primary shrink-0" />
                <a href={`tel:${phone}`} dir="ltr" className="hover:text-primary transition-colors">
                  {formatLibyanPhone(phone)}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Store Links */}
        <nav aria-label="روابط المتجر">
          <h3 className="mb-3 text-sm font-bold text-foreground">{t('footer.shop.title')}</h3>
          <ul className="space-y-1.5">
            {STORE_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  viewTransition
                  className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Account & Support Links */}
        <nav aria-label="خدمات العملاء">
          <h3 className="mb-3 text-sm font-bold text-foreground">{t('footer.account.title')}</h3>
          <ul className="space-y-1.5">
            {ACCOUNT_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  viewTransition
                  className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Copyright */}
      <div className="border-t border-border/80 bg-muted/30 px-4 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-center text-center text-xs text-muted-foreground">
          <p className="leading-relaxed">© {currentYear} {legalName}. {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  )
}
