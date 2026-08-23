import {
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

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
  { to: '/developers/api', label: 'بوابة المطورين والشركاء' },
]

const TRUST_BADGES = [
  {
    icon: Sparkles,
    title: 'عطور أصلية 100%',
    description: 'ماركات عالمية وأصلية مضمونة',
  },
  {
    icon: Truck,
    title: 'توصيل لجميع مدن ليبيا',
    description: 'شحن سريع وموثوق لباب بيتك',
  },
  {
    icon: ShieldCheck,
    title: 'دفع آمن ومريح',
    description: 'سداد، معاملات، بطاقات، أو كاش',
  },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-border bg-card/60 backdrop-blur-sm">
      {/* Trust Badges Strip */}
      <div className="border-b border-border/80 bg-muted/20">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3">
          {TRUST_BADGES.map((badge, idx) => {
            const Icon = badge.icon
            return (
              <div key={idx} className="flex items-center gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-foreground">{badge.title}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{badge.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main 3-Column Footer */}
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 md:grid-cols-3">
        {/* Brand info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <img src="/brand/logo.svg" alt="" width={24} height={24} className="size-6" />
            </div>
            <span className="font-display text-xl font-bold tracking-wide text-foreground">نسائم ليبيا</span>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
            نسائم ليبيا لاستيراد وتوزيع العطور الفاخرة والزيوت العطرية — مصراتة، ليبيا. نوفر أرقى تشكيلات العطور بالجملة والقطاعي مع خدمة توصيل احترافية لكافة المدن.
          </p>
          <div className="space-y-1.5 pt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary shrink-0" />
              <span>مصراتة — ليبيا</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-primary shrink-0" />
              <span dir="ltr">+218 91 000 0000</span>
            </div>
          </div>
        </div>

        {/* Store Links */}
        <nav aria-label="روابط المتجر">
          <h3 className="mb-3 text-sm font-bold text-foreground">المتجر والتسوق</h3>
          <ul className="space-y-1.5">
            {STORE_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  viewTransition
                  className="inline-flex h-8 items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Account & Support Links */}
        <nav aria-label="خدمات العملاء">
          <h3 className="mb-3 text-sm font-bold text-foreground">خدمات الحساب</h3>
          <ul className="space-y-1.5">
            {ACCOUNT_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  viewTransition
                  className="inline-flex h-8 items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Payment Badges & Copyright */}
      <div className="border-t border-border/80 bg-muted/30 px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row text-xs text-muted-foreground">
          <p>© {currentYear} شركة نسائم ليبيا لاستيراد العطور. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-foreground">طرق الدفع المعتمدة:</span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-bold font-mono">
                سداد Sadad
              </span>
              <span className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-bold font-mono">
                معاملات Moamalat
              </span>
              <span className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-bold font-mono">
                تداول Tadawul
              </span>
              <span className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-bold">
                الدفع عند الاستلام
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
