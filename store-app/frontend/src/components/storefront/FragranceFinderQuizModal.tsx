import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Gift,
  Heart,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  User,
  Users,
  Wind,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link } from '@/lib/i18nRouter'

import { Button } from '@/components/ui/button'
import { LineThumb } from '@/components/ui/line-thumb'
import { currencySymbol, formatPrice } from '@/lib/format'
import { useAddToCart } from '@/lib/queries/cart'
import {
  type FragranceFinderRecommendation,
  useFragranceFinder,
} from '@/lib/queries/search'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

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
  const [addedIds, setAddedIds] = React.useState<string[]>([])

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
        aria-label={t('quiz.label')}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Compass className="size-4" />
            </span>
            <div>
              <h3 className="text-base font-black text-foreground">{t('quiz.title')}</h3>
              <p className="text-xs text-muted-foreground">{t('quiz.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center px-2 text-muted-foreground hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        {step <= 3 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-muted-foreground">
              <span>{t('quiz.step', { n: step })}</span>
              <span>{step === 1 ? t('quiz.stepWho') : step === 2 ? t('quiz.stepFamily') : t('quiz.stepOccasion')}</span>
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
            <h4 className="text-sm font-bold text-foreground">{t('quiz.who')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'MEN', label: t('quiz.men'), desc: t('quiz.menDesc'), icon: User },
                { id: 'WOMEN', label: t('quiz.women'), desc: t('quiz.womenDesc'), icon: Heart },
                { id: 'UNISEX', label: t('quiz.unisex'), desc: t('quiz.unisexDesc'), icon: Users },
                { id: 'GIFT', label: t('quiz.gift'), desc: t('quiz.giftDesc'), icon: Gift },
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
                <span>{t('quiz.nextFamily')}</span>
                <ArrowLeft className="size-4 ltr:-scale-x-100" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Olfactory Vibe */}
        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground">{t('quiz.family')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'ORIENTAL', label: t('quiz.oriental'), desc: t('quiz.orientalDesc'), icon: Sparkles },
                { id: 'FRESH', label: t('quiz.fresh'), desc: t('quiz.freshDesc'), icon: Wind },
                { id: 'WARM', label: t('quiz.warm'), desc: t('quiz.warmDesc'), icon: Heart },
                { id: 'WOODY', label: t('quiz.woody'), desc: t('quiz.woodyDesc'), icon: Compass },
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
                <ArrowRight className="size-4 ltr:-scale-x-100" />
                <span>{t('quiz.previous')}</span>
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="gap-2 rounded-xl font-bold min-h-11 px-6 text-xs"
              >
                <span>{t('quiz.nextOccasion')}</span>
                <ArrowLeft className="size-4 ltr:-scale-x-100" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Occasion & Budget */}
        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-foreground">{t('quiz.occasionBudget')}</h4>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{t('quiz.occasion')}</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'EVENING', label: t('quiz.evening') },
                  { id: 'FORMAL', label: t('quiz.formal') },
                  { id: 'DAILY', label: t('quiz.daily') },
                  { id: 'ALL', label: t('quiz.all') },
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
              <label className="text-xs font-bold text-muted-foreground">{t('quiz.budget')}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '200', label: t('quiz.under200', { currency: currencySymbol() }) },
                  { id: '400', label: t('quiz.upTo400', { currency: currencySymbol() }) },
                  { id: 'ALL', label: t('quiz.anyBudget') },
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
                <ArrowRight className="size-4 ltr:-scale-x-100" />
                <span>{t('quiz.previous')}</span>
              </Button>
              <Button
                onClick={handleFinishQuiz}
                loading={finderMutation.isPending}
                className="gap-2 rounded-xl font-bold min-h-11 px-6 text-xs shadow-xs"
              >
                <Sparkles className="size-4" />
                <span>{t('quiz.showResults')}</span>
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
                <h4 className="text-sm font-black text-foreground">
                  {results.some((rec) => rec.exact) ? t('quiz.close') : t('quiz.noMatch')}
                </h4>
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
                <span>{t('quiz.restart')}</span>
              </button>
            </div>

            <div className="space-y-4">
              {results.map((rec) => {
                const p = rec.product
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-primary/25 bg-card p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3.5">
                      <LineThumb image={p.images?.[0]} alt={p.name} size={64} />

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs sm:text-sm font-black text-foreground truncate">
                            {p.name}
                          </h5>
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

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {p.has_variants && (p.variant_choices?.length ?? 0) !== 1 ? (
                        // A sized product needs a size, which is chosen on its page.
                        <Button size="sm" asChild className="flex-1 min-h-11 rounded-xl font-bold text-xs gap-1.5">
                          <Link to={`/products/${encodeURIComponent(p.slug)}`} onClick={onClose}>
                            <ShoppingBag className="size-3.5" />
                            <span>{t('quiz.chooseSize')}</span>
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            // A single size is added as that size.
                            const sole = p.variant_choices?.length === 1 ? p.variant_choices[0] : undefined
                            addToCart.mutate(
                              { product_id: p.id, variant_id: sole?.id ?? null, quantity: 1 },
                              { onSuccess: () => setAddedIds((ids) => [...ids, p.id]) },
                            )
                          }}
                          disabled={addToCart.isPending || !p.in_stock}
                          className="flex-1 min-h-11 rounded-xl font-bold text-xs gap-1.5"
                        >
                          <ShoppingBag className="size-3.5" />
                          <span>{!p.in_stock ? t('stock.out') : addedIds.includes(p.id) ? t('quiz.added') : t('card.addToCart')}</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="min-h-11 rounded-xl font-bold text-xs"
                      >
                        <Link to={`/products/${p.slug}`} onClick={onClose}>
                          {t('quiz.details')}
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
