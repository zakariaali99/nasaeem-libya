import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Gift,
  Heart,
  Package,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  User,
  Users,
  Wind,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { useAddToCart } from '@/lib/queries/cart'
import {
  type FragranceFinderRecommendation,
  useFragranceFinder,
} from '@/lib/queries/search'
import { cn } from '@/lib/utils'

interface FragranceFinderQuizModalProps {
  open: boolean
  onClose: () => void
}

export function FragranceFinderQuizModal({ open, onClose }: FragranceFinderQuizModalProps) {
  const [step, setStep] = React.useState(1)
  const [gender, setGender] = React.useState('MEN')
  const [vibe, setVibe] = React.useState('ORIENTAL')
  const [occasion, setOccasion] = React.useState('EVENING')
  const [budget, setBudget] = React.useState('ALL')
  const [results, setResults] = React.useState<FragranceFinderRecommendation[]>([])

  const finderMutation = useFragranceFinder()
  const addToCart = useAddToCart()

  React.useEffect(() => {
    if (!open) {
      setStep(1)
      setResults([])
    }
  }, [open])

  if (!open) return null

  const handleFinishQuiz = () => {
    finderMutation.mutate(
      {
        gender,
        vibe,
        occasion,
        budget: budget !== 'ALL' ? budget : undefined,
      },
      {
        onSuccess: (data) => {
          setResults(data)
          setStep(4) // Results step
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="مرشد العطور الذكي"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Compass className="size-4" />
            </span>
            <div>
              <h3 className="text-base font-black text-foreground">مرشد العطور الذكي (Fragrance Finder)</h3>
              <p className="text-xs text-muted-foreground">اكتشف العطر المثالي لشخصيتك ومناسبتك في 3 خطوات</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center px-2 text-muted-foreground hover:text-foreground"
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        {step <= 3 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-muted-foreground">
              <span>الخطوة {step} من 3</span>
              <span>{step === 1 ? 'المستهدف' : step === 2 ? 'الطابع العطري' : 'المناسبة والميزانية'}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* STEP 1: Gender / Target */}
        {step === 1 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground">1. من سيرتدي هذا العطر؟</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'MEN', label: 'عطر رجالي فخم', desc: 'حضور قوي ووقار مميز', icon: User },
                { id: 'WOMEN', label: 'عطر نسائي جذاب', desc: 'نعومة وأناقة ساحرة', icon: Heart },
                { id: 'UNISEX', label: 'عطر محايد للجنسين', desc: 'توليفة متوازنة تناسب الجميع', icon: Users },
                { id: 'GIFT', label: 'هدية لشخص عزيز', desc: 'عطر فاخر يبيض الوجه', icon: Gift },
              ].map((opt) => {
                const Icon = opt.icon
                const isSelected = gender === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGender(opt.id)}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-2xl border p-4 text-start transition-all shadow-2xs',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs shadow-primary/20'
                        : 'border-border bg-muted/20 hover:border-primary/50',
                    )}
                  >
                    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-black text-foreground">{opt.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{opt.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setStep(2)}
                className="gap-2 rounded-xl font-bold min-h-11 px-6 text-xs"
              >
                <span>التالي: الطابع العطري</span>
                <ArrowLeft className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Olfactory Vibe */}
        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground">2. ما هو الطابع العطري الذي تفضله؟</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'ORIENTAL', label: 'شرقي وبخور ملكي', desc: 'عود وعنبر وتوابل دافئة', icon: Sparkles },
                { id: 'FRESH', label: 'صيفي ومنعش', desc: 'حمضيات وبرغموت ونسيم البحر', icon: Wind },
                { id: 'WARM', label: 'دافئ وجذاب', desc: 'فانيليا ومسك وتونكا ناعمة', icon: Heart },
                { id: 'WOODY', label: 'أخشاب وجلود فاخرة', desc: 'خشب الصندل والأرز والجلود', icon: Compass },
              ].map((opt) => {
                const Icon = opt.icon
                const isSelected = vibe === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVibe(opt.id)}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-2xl border p-4 text-start transition-all shadow-2xs',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs shadow-primary/20'
                        : 'border-border bg-muted/20 hover:border-primary/50',
                    )}
                  >
                    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-black text-foreground">{opt.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{opt.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="gap-2 rounded-xl font-bold min-h-11 px-4 text-xs"
              >
                <ArrowRight className="size-4" />
                <span>السابق</span>
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="gap-2 rounded-xl font-bold min-h-11 px-6 text-xs"
              >
                <span>التالي: المناسبة والميزانية</span>
                <ArrowLeft className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Occasion & Budget */}
        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground">3. ما هي المناسبة والميزانية المتوقعة؟</h4>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">المناسبة الأساسية:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'EVENING', label: '👑 سهرات ومناسبات خاصة' },
                  { id: 'FORMAL', label: '💼 لقاءات عمل رسمية' },
                  { id: 'DAILY', label: '🌿 استخدام يومي ودوام' },
                  { id: 'ALL', label: '✨ مناسب لكافة الأوقات' },
                ].map((occ) => (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => setOccasion(occ.id)}
                    className={cn(
                      'flex min-h-11 items-center justify-center rounded-xl border p-3 text-xs font-bold transition-all',
                      occasion === occ.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted/20 text-foreground hover:border-primary/50',
                    )}
                  >
                    {occ.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-muted-foreground">الميزانية المقترحة:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '200', label: 'أقل من 200 د.ل' },
                  { id: '400', label: 'حتى 400 د.ل' },
                  { id: 'ALL', label: 'أي ميزانية (فاخر)' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudget(b.id)}
                    className={cn(
                      'flex min-h-11 items-center justify-center rounded-xl border p-3 text-xs font-bold transition-all',
                      budget === b.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted/20 text-foreground hover:border-primary/50',
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="gap-2 rounded-xl font-bold min-h-11 px-4 text-xs"
              >
                <ArrowRight className="size-4" />
                <span>السابق</span>
              </Button>
              <Button
                onClick={handleFinishQuiz}
                loading={finderMutation.isPending}
                className="gap-2 rounded-xl font-bold min-h-11 px-6 text-xs shadow-xs"
              >
                <Sparkles className="size-4" />
                <span>عرض العطور الموصى بها</span>
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Results Display */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-primary" />
                <h4 className="text-sm font-black text-foreground">أفضل 3 عطور مطابقة لاختياراتك</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setResults([])
                }}
                className="flex min-h-11 items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <RotateCcw className="size-3.5" />
                <span>إعادة الاختبار</span>
              </button>
            </div>

            <div className="space-y-4">
              {results.map((rec) => {
                const p = rec.product
                const img = p.images?.[0]?.url
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-primary/25 bg-card p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3.5">
                      {img ? (
                        <img
                          src={img}
                          alt={p.name}
                          className="size-16 rounded-xl object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="size-16 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                          <Package className="size-8" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs sm:text-sm font-black text-foreground truncate">
                            {p.name}
                          </h5>
                          <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                            تطابق {rec.match_score}%
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-primary">
                            {formatPrice(p.price || '0')}
                          </span>
                          {p.compare_at_price && (
                            <span className="font-mono text-xs text-muted-foreground line-through">
                              {formatPrice(p.compare_at_price)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reason Justification */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
                      <strong className="text-primary font-bold">لماذا يناسبك: </strong>
                      <span>{rec.reason}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          addToCart.mutate({ product_id: p.id, quantity: 1 })
                        }}
                        disabled={addToCart.isPending}
                        className="flex-1 min-h-11 rounded-xl font-bold text-xs gap-1.5"
                      >
                        <ShoppingBag className="size-3.5" />
                        <span>إضافة سريعة للسلة</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="min-h-11 rounded-xl font-bold text-xs"
                      >
                        <Link to={`/products/${p.slug}`} onClick={onClose}>
                          عرض التفاصيل
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
