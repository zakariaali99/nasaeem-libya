import { ArrowLeft, CheckCircle2, FlaskConical, Gift } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function DiscoveryBoxBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-linear-to-r from-primary/10 via-card to-amber-500/10 p-5 sm:p-7 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shrink-0">
            <FlaskConical className="size-6" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm sm:text-base font-black text-foreground">
                باقة عينات التجربة واسترداد القيمة 100%
              </h4>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                ضمان الرضا الكامل 🧪
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              جرّب 5 عينات فاخرة بحجم 5 مل براحتك في البيت بـ 60 د.ل فقط، وسنمنحك كوبون استرداد فوري بـ 60 د.ل يُخصم بالكامل عند طلبك الزجاجة الأصلية خلال 14 يوماً!
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-bold text-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-primary" />
                <span>5 عينات عطور فاخرة</span>
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-primary" />
                <span>كوبون كاش باك 100%</span>
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-primary" />
                <span>توصيل سريع لكل المدن</span>
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <Button asChild size="sm" className="min-h-11 rounded-2xl px-5 font-black text-xs gap-1.5 shadow-sm w-full sm:w-auto">
            <Link to="/search?q=عينات">
              <Gift className="size-4" />
              <span>اطلب باقة التجربة الآن</span>
              <ArrowLeft className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Luxury Background Glow */}
      <div className="absolute -top-12 -end-12 size-40 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
    </div>
  )
}
