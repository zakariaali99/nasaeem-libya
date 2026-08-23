import { Camera, CheckCircle2, MessageSquarePlus, Sparkles, Star, User, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useProductReviews, useCreateProductReview } from '@/lib/queries/reviews'
import { useMe } from '@/lib/queries/auth'
import { cn } from '@/lib/utils'

interface VerifiedPhotoReviewsProps {
  productSlug: string
  productName: string
}

export function VerifiedPhotoReviews({ productSlug, productName }: VerifiedPhotoReviewsProps) {
  const { data: reviewsData, isLoading } = useProductReviews(productSlug)
  const { data: user } = useMe()
  const createReview = useCreateProductReview(productSlug)

  const [modalOpen, setModalOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reviews = reviewsData?.reviews || []
  const avgRating = reviewsData?.average_rating || 5.0
  const totalReviews = reviewsData?.total_reviews || 0
  const breakdown = reviewsData?.rating_breakdown || { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!comment.trim()) {
      setErrorMsg('يرجى كتابة نص التقييم')
      return
    }

    try {
      const res = await createReview.mutateAsync({
        rating,
        title,
        comment,
        photo_url: photoUrl,
      })
      setSuccessMsg(res.message || 'تم إرسال تقييمك بنجاح!')
      setTimeout(() => {
        setModalOpen(false)
        setSuccessMsg(null)
        setComment('')
        setTitle('')
        setPhotoUrl('')
      }, 2500)
    } catch {
      setErrorMsg('تعذّر إرسال التقييم، يرجى المحاولة مرة أخرى.')
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-black text-foreground">
              تقييمات وتجارب العملاء الحقيقية
            </h3>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
              مشترون مؤكدون 🛡️
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            تجارب حقيقية موثقة من عملاء نسائم ليبيا الذين جربوا هذا العطر
          </p>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="min-h-11 rounded-2xl px-5 font-black text-xs gap-2 shadow-xs"
        >
          <MessageSquarePlus className="size-4" />
          <span>أضف تقييمك واكسب 50 نقطة</span>
          <Sparkles className="size-3.5 text-primary" />
        </Button>
      </div>

      {/* Aggregate Rating Score and Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-[12rem_1fr] gap-6 items-center rounded-2xl bg-muted/30 p-4 sm:p-5 border border-border">
        <div className="flex flex-col items-center justify-center text-center space-y-1.5 border-b md:border-b-0 md:border-e border-border/80 pb-4 md:pb-0 md:pe-4">
          <span className="font-mono text-4xl sm:text-5xl font-black text-foreground">
            {avgRating}
          </span>
          <div className="flex items-center gap-1 text-rating">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={cn(
                  'size-4',
                  s <= Math.round(avgRating) ? 'fill-rating text-rating' : 'text-muted-foreground/30',
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-bold">
            بناءً على {totalReviews} تقييماً
          </span>
        </div>

        {/* Stars Bars */}
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = breakdown[String(stars)] || 0
            const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0
            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 text-muted-foreground font-bold flex items-center gap-1 shrink-0">
                  <span>{stars}</span>
                  <Star className="size-3 fill-rating text-rating" />
                </span>
                <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-muted-foreground w-8 text-end">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">جاري تحميل التقييمات...</p>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 rounded-2xl border border-dashed border-border p-6 space-y-2">
          <p className="text-xs font-bold text-foreground">كن أول من يقيّم عطر «{productName}»!</p>
          <p className="text-[11px] text-muted-foreground">
            شاركنا رأيك بتجربة العطر واكسب 50 نقطة ولاء فورية تُضاف لرصيدك الملكي.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                    <User className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{rev.user_name}</h4>
                    {rev.is_verified_buyer ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        <span>مشترٍ مؤكد ✅</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">عميل معتمد</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 text-rating">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        'size-3.5',
                        s <= rev.rating ? 'fill-rating text-rating' : 'text-muted-foreground/30',
                      )}
                    />
                  ))}
                </div>
              </div>

              {rev.title && (
                <h5 className="text-xs font-black text-foreground">{rev.title}</h5>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">
                «{rev.comment}»
              </p>

              {rev.photo_url && (
                <div className="pt-1">
                  <img
                    src={rev.photo_url}
                    alt="تجربة العميل"
                    className="size-20 rounded-xl object-cover border border-border shadow-2xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Submission Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-rise">
          <div className="w-full max-w-lg rounded-3xl border border-primary/30 bg-card p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h4 className="text-sm font-black text-foreground">
                  تقييم تجربة «{productName}»
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex size-9 items-center justify-center rounded-xl bg-muted/50 text-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {!user ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-muted-foreground font-bold">
                  يرجى تسجيل الدخول بحسابك لكتابة التقييم وكسب 50 نقطة مكافأة.
                </p>
                <Button asChild size="sm" className="rounded-xl font-bold">
                  <a href={`/login?next=/products/${productSlug}`}>تسجيل الدخول</a>
                </Button>
              </div>
            ) : successMsg ? (
              <div className="text-center py-8 space-y-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-10 mx-auto" />
                <p className="text-sm font-black">{successMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <p className="rounded-xl bg-destructive/10 p-2.5 text-xs font-bold text-destructive">
                    {errorMsg}
                  </p>
                )}

                {/* Rating Selection */}
                <div className="space-y-1.5 text-center">
                  <label className="text-xs font-bold text-foreground block">
                    درجة التقييم:
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 cursor-pointer transition-transform hover:scale-125"
                      >
                        <Star
                          className={cn(
                            'size-7',
                            s <= (hoverRating || rating)
                              ? 'fill-rating text-rating'
                              : 'text-muted-foreground/30',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">عنوان التقييم (اختياري):</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: ثبات خرافي وفوحان لا يُعلى عليه"
                    className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">تجربتك المفصلة مع العطر *:</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="كيف كانت تجربة الثبات والفوحان؟ متى تفضل استخدامه؟"
                    rows={3}
                    className="w-full rounded-xl border border-input bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Camera className="size-3.5 text-primary" />
                    <span>رابط صورة زجاجة العطر (اختياري لتأكيد التجربة):</span>
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </div>

                <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-[11px] font-bold text-primary flex items-center gap-2">
                  <Sparkles className="size-4 shrink-0" />
                  <span>ستحصل فوراً على +50 نقطة ولاء في حسابك الملكي عند نشر تقييمك!</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalOpen(false)}
                    className="min-h-11 rounded-xl text-xs"
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={createReview.isPending}
                    className="min-h-11 rounded-xl font-bold text-xs px-6"
                  >
                    {createReview.isPending ? 'جاري الإرسال...' : 'نشر التقييم واكتساب النقاط'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
