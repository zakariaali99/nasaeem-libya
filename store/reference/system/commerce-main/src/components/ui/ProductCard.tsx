"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, ShoppingCart, Loader2 } from "lucide-react";
import type { ProductDiscount } from '@/modules/products/types/productTypes';
import { Button } from '@/components/ui/button';
import { useCart, useCartActions } from '@/hooks/use-cart';
import { useAppSession } from '@/components/providers/SessionProvider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { analyticsClient } from '@/modules/analytics/client/analyticsClient';

interface ProductCardProps {
  name: string;
  price: number | string;
  imageUrl: string;
  slug: string;
  discounts?: ProductDiscount[];
  productId?: string; // مطلوب للإضافة المباشرة للسلة عندما لا توجد خيارات
  hasVariants?: boolean; // إذا كان للمنتج خيارات فسنوجّه لصفحة المنتج
  availableQuantity?: number | null; // لتعطيل الزر إن كان غير متوفر
}

export function ProductCard({ name, price, imageUrl, slug, discounts = [], productId, hasVariants = false, availableQuantity }: ProductCardProps) {
  const formattedPrice = price != null
    ? price.toLocaleString('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0 })
    : 'غير متوفر';

  const router = useRouter();
  const cart = useCart();
  const cartActions = useCartActions();
  const { session } = useAppSession();
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  const [loadingAction, setLoadingAction] = React.useState<null | 'add' | 'remove'>(null);

  const emitCardClick = (origin: 'image' | 'title' | 'cta_button') => {
    analyticsClient.trackProductEngagement('card_click', {
      origin,
      productId,
      slug,
      source: 'listing',
    });
  };

  const currentQuantity = React.useMemo(() => {
    if (!productId) return 0;
    const item = cart?.items.find(i => i.productId === productId && !i.variantId);
    return item?.quantity || 0;
  }, [cart?.items, productId]);

  const formatNoDecimals = (val: number | string | null | undefined) => {
    const num = Number(val);
    if (Number.isNaN(num)) return '';
    return num.toLocaleString('ar-LY', { maximumFractionDigits: 0 });
  };

  const primaryDiscountText = React.useMemo(() => {
    if (!discounts || discounts.length === 0) return '';
    const d = discounts[0];
    switch (d.type) {
      case 'percentage':
        return `${formatNoDecimals(d.percentage)}% خصم`;
      case 'fixed':
        return `خصم ${formatNoDecimals(d.value)} د.ل`;
      case 'bogo':
        return `اشترِ ${d.bogo?.buy} واحصل على ${d.bogo?.get}${d.bogo?.free ? ' مجانا' : ''}`;
      case 'tiered':
        return d.tiered?.map(t => `${t.minQty}+ : ${formatNoDecimals(t.discount)}%`).join(', ') || '';
      default:
        return d.name || '';
    }
  }, [discounts]);

  return (
    <div className="group relative w-full h-full flex flex-col gap-4" dir="rtl">
      <Link
        href={`/products/${slug}`}
        className="block"
        onClick={() => emitCardClick('image')}
      >
        <figure className="relative group-hover:opacity-90">
          {primaryDiscountText && (
            <div className="absolute top-2 left-2 z-10">
              <span
                aria-label="شارة الخصم"
                suppressHydrationWarning
                className="inline-flex items-center rounded-full bg-green-50/90 dark:bg-green-900/60 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-green-800 dark:text-green-100 border border-green-200/80 dark:border-green-700 ring-1 ring-green-700/10 shadow-sm"
              >
                {primaryDiscountText}
              </span>
            </div>
          )}
          {/* أزلنا زر التراكب وسنمزج الإضافة مع عرض السعر */}
          {imageUrl ? (
            // using fixed square image so layout matches the provided snippet
            <Image
              src={imageUrl}
              alt={name}
              width={300}
              height={300}
              className="aspect-square w-full"
              style={{ objectFit: 'cover', color: 'transparent' }}
            />
          ) : (
            <div className="aspect-square w-full bg-gray-100 flex items-center justify-center">
              <ImageOff size={48} className="text-gray-300" />
            </div>
          )}
        </figure>
      </Link>

      {/* صف لعنوان المنتج فقط */}
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <Link
            href={`/products/${slug}`}
            className="block"
            onClick={() => emitCardClick('title')}
          >
            <h3 className="text-lg font-medium truncate">{name}</h3>
          </Link>
        </div>
      </div>

      {/* صف مستقل لزر إضافة إلى السلة مع السعر داخله */}
      <div className="flex w-full mt-auto">
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full rounded-full h-11 px-4 bg-white/80 dark:bg-gray-900/60 backdrop-blur border border-gray-200/80 dark:border-gray-700 ring-1 ring-black/5 shadow-sm hover:bg-white hover:shadow transition flex items-center justify-between"
          onClick={async (e) => {
            if (hasVariants || !productId) {
              emitCardClick('cta_button');
              router.push(`/products/${slug}`);
              return;
            }
            if (!session) {
              setAuthDialogOpen(true);
              return;
            }
            if (currentQuantity > 0) {
              try {
                setLoadingAction('remove');
                await cartActions.removeItem({ productId });
              } finally {
                setLoadingAction(null);
              }
              return;
            }
            if (availableQuantity === 0) return;
            try {
              setLoadingAction('add');
              await cartActions.addItem({ productId, quantity: 1 });
            } finally {
              setLoadingAction(null);
            }
          }}
          disabled={
            (hasVariants || !productId)
              ? false
              : ((availableQuantity === 0 && currentQuantity === 0) || loadingAction !== null)
          }
          title={hasVariants || !productId ? 'التفاصيل و الاختيارات' : currentQuantity > 0 ? 'إزالة من السلة' : 'أضف إلى السلة'}
        >
          {hasVariants || !productId ? (
            <>
              <span className="text-base font-semibold rtl:ml-0 rtl:mr-2" suppressHydrationWarning>{formattedPrice}</span>
              <ShoppingCart size={18} />
            </>
          ) : currentQuantity > 0 ? (
            <>
              <span className="text-base font-semibold rtl:ml-0 rtl:mr-2">تمت الإضافة</span>
              {loadingAction === 'remove' ? <Loader2 className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
            </>
          ) : (
            <>
              <span className="text-base font-semibold rtl:ml-0 rtl:mr-2" suppressHydrationWarning>{formattedPrice}</span>
              {loadingAction === 'add' ? <Loader2 className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
            </>
          )}
        </Button>
      </div>

      {/* Buttons row - commented out as requested (favorite & add to cart) */}
      {/*
      <div className="flex gap-4 mt-3">
        <button
          data-slot="button"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 size-9 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
        </button>

        <button
          data-slot="button"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 flex-1 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
          Add to Card
        </button>
      </div>
      */}

      {/* تم تحويل عرض الخصومات إلى شارة أعلى الصورة لواجهة أنظف */}
      {/* حوار التوجيه للتسجيل/الدخول عند محاولة الإضافة بدون جلسة */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>يرجى التسجيل أو تسجيل الدخول</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            يجب أن تكون مسجلا للدخول لإضافة عناصر إلى السلة.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAuthDialogOpen(false); router.push('/register'); }}>
              تسجيل
            </Button>
            <Button onClick={() => { setAuthDialogOpen(false); router.push('/login'); }}>
              تسجيل الدخول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
