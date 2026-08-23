import { CreditCard, ShieldCheck, Sparkles, Truck } from 'lucide-react'

export function ProductTrustBadges() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* 1. 100% Original Guarantee */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-2xs">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <span className="block text-xs font-black text-foreground">أصلي ومضمون 100%</span>
          <span className="block text-[10px] text-muted-foreground">مستورد من الوكيل الرسمي</span>
        </div>
      </div>

      {/* 2. Fast Delivery */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-2xs">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Truck className="size-4" />
        </div>
        <div>
          <span className="block text-xs font-black text-foreground">توصيل سريع 24-48 ساعة</span>
          <span className="block text-[10px] text-muted-foreground">لكافة المدن الليبية</span>
        </div>
      </div>

      {/* 3. Inspection on Delivery */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-2xs">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Sparkles className="size-4" />
        </div>
        <div>
          <span className="block text-xs font-black text-foreground">المعاينة قبل الاستلام</span>
          <span className="block text-[10px] text-muted-foreground">افحص العطر مع المندوب</span>
        </div>
      </div>

      {/* 4. Flexible Payment Options */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-2xs">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CreditCard className="size-4" />
        </div>
        <div>
          <span className="block text-xs font-black text-foreground">كاش أو بطاقات دفع</span>
          <span className="block text-[10px] text-muted-foreground">سداد، بطاقات، كاش</span>
        </div>
      </div>
    </div>
  )
}
