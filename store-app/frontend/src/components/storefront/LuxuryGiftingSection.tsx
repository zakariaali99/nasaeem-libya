import { Check, EyeOff, Gift, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface GiftingState {
  is_gift: boolean
  gift_wrap_type: 'ROYAL_VELVET' | 'CLASSIC_ELEGANCE'
  gift_sender_name: string
  gift_recipient_name: string
  gift_message: string
  hide_invoice_prices: boolean
}

interface LuxuryGiftingSectionProps {
  value: GiftingState
  onChange: (next: GiftingState) => void
}

const MESSAGE_TEMPLATES = [
  'كل عام وأنت بألف خير.. عطر يليق بمقامك الرفيع ويزيد أيامك بهاءً.',
  'ألف مبارك النجاح والتخرج، ومن تألق إلى تألق دائم بإذن الله.',
  'هدية بسيطة تعبيراً عن خالص المحبة والتقدير لشخصك الاستثنائي.',
  'بارك الله لكما وبارك عليكما وجمع بينكما في خير.. مبارك الزواج السعيد.',
]

export function LuxuryGiftingSection({ value, onChange }: LuxuryGiftingSectionProps) {
  const toggleGift = (enabled: boolean) => {
    onChange({
      ...value,
      is_gift: enabled,
      hide_invoice_prices: enabled ? true : value.hide_invoice_prices,
    })
  }

  return (
    <div className="rounded-3xl border border-primary/25 bg-linear-to-b from-card via-card to-primary/5 p-4 sm:p-6 shadow-sm space-y-5">
      {/* Main Activation Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-2xs">
            <Gift className="size-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-black text-foreground flex items-center gap-1.5">
              <span>جناح الإهداء والتغليف الفاخر</span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                الملكي
              </span>
            </h4>
            <p className="text-xs text-muted-foreground">
              أرسل طلبك كهدية مغلفة بأفخم الأوراق مع كرت إهداء شخصي مطبوع
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleGift(!value.is_gift)}
          role="switch"
          aria-checked={value.is_gift}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-ring',
            value.is_gift ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block size-5 transform rounded-full bg-card shadow-lg ring-0 transition duration-200 ease-in-out',
              value.is_gift ? '-translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      {value.is_gift && (
        <div className="space-y-5 pt-2 animate-fade-rise border-t border-border/80">
          {/* Packaging Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-foreground">
              اختر نوع التغليف الملكي:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Royal Velvet */}
              <button
                type="button"
                onClick={() => onChange({ ...value, gift_wrap_type: 'ROYAL_VELVET' })}
                className={cn(
                  'flex min-h-11 items-start gap-3 rounded-2xl border p-3.5 text-start transition-all shadow-2xs',
                  value.gift_wrap_type === 'ROYAL_VELVET'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                  value.gift_wrap_type === 'ROYAL_VELVET'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30',
                )}>
                  {value.gift_wrap_type === 'ROYAL_VELVET' && <Check className="size-3" />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-foreground">التغليف الملكي المخملي 👑</span>
                    <span className="font-mono text-xs font-black text-primary">+15.00 د.ل</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    علبة فاخرة مخملية سوداء + شريطة حرير ذهبية + كيس هدايا ملكي
                  </p>
                </div>
              </button>

              {/* Classic Elegance */}
              <button
                type="button"
                onClick={() => onChange({ ...value, gift_wrap_type: 'CLASSIC_ELEGANCE' })}
                className={cn(
                  'flex min-h-11 items-start gap-3 rounded-2xl border p-3.5 text-start transition-all shadow-2xs',
                  value.gift_wrap_type === 'CLASSIC_ELEGANCE'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                  value.gift_wrap_type === 'CLASSIC_ELEGANCE'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30',
                )}>
                  {value.gift_wrap_type === 'CLASSIC_ELEGANCE' && <Check className="size-3" />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-foreground">تغليف الأناقة الكلاسيكي 🎀</span>
                    <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">مجاناً</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    ورق تغليف هدايا إيطالي فاخر وشريطة أنيقة ناعمة
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Calligraphy Gift Card Fields */}
          <div className="rounded-2xl border border-primary/20 bg-card p-4 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h5 className="text-xs font-black text-foreground">
                كرت الإهداء المخصص (طباعة بخط عربي فاخر)
              </h5>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">اسم المُهدي (من):</label>
                <input
                  type="text"
                  value={value.gift_sender_name}
                  onChange={(e) => onChange({ ...value, gift_sender_name: e.target.value })}
                  placeholder="مثال: محمد الفرجاني"
                  className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">اسم المُهدى إليه (إلى):</label>
                <input
                  type="text"
                  value={value.gift_recipient_name}
                  onChange={(e) => onChange({ ...value, gift_recipient_name: e.target.value })}
                  placeholder="مثال: د. سارة الورفلي"
                  className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">رسالة الإهداء الشخصية:</label>
                <span className="text-[10px] text-muted-foreground">أقصى حد 200 حرف</span>
              </div>
              <textarea
                value={value.gift_message}
                maxLength={200}
                onChange={(e) => onChange({ ...value, gift_message: e.target.value })}
                placeholder="اكتب رسالتك الخاصة أو اختر من النماذج الجاهزة أدناه..."
                rows={3}
                className="w-full rounded-xl border border-input bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
              />

              {/* Fast Message Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-muted-foreground">نماذج مقترحة سريعة:</span>
                <div className="flex flex-wrap gap-1.5">
                  {MESSAGE_TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onChange({ ...value, gift_message: tpl })}
                      className="rounded-xl border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-bold text-foreground hover:border-primary/40 hover:bg-primary/10 transition-colors text-start"
                    >
                      {tpl.length > 35 ? `${tpl.slice(0, 35)}...` : tpl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Privacy Option */}
          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-border/80 bg-muted/30 p-3.5 cursor-pointer hover:bg-muted/50 transition-colors">
            <input
              type="checkbox"
              checked={value.hide_invoice_prices}
              onChange={(e) => onChange({ ...value, hide_invoice_prices: e.target.checked })}
              className="size-4 rounded-sm border-primary text-primary focus:ring-primary/20 shrink-0"
            />
            <div className="flex items-center gap-2">
              <EyeOff className="size-4 text-primary shrink-0" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">
                  إخفاء الأسعار وتفاصيل الفاتورة من طرد التوصيل
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  لن تظهر أي مبالغ مالية على بوليصة الشحن أو الكرت حتى تظل الهدية ذات طابع راقٍ وخاص.
                </span>
              </div>
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
