'use client';

import { useCart } from '@/hooks/use-cart';
import { cartClient, DetailedCartItem } from '@/modules/cart/client/cartClient';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Trash2, Plus, Minus, ShoppingCart, Loader2, AlertCircle, MapPin, Truck, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/modules/analytics/client/analyticsClient';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';

function CartSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50" dir="rtl">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="animate-pulse rounded-2xl bg-white shadow-sm border border-slate-100 p-6 space-y-4">
          <div className="h-6 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-28 bg-slate-200 rounded" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2].map((key) => (
              <div key={key} className="animate-pulse bg-white border border-slate-100 shadow-sm rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex gap-4">
                  <div className="h-24 w-24 rounded-lg bg-slate-200" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-3/5 bg-slate-200 rounded" />
                    <div className="h-4 w-1/3 bg-slate-200 rounded" />
                    <div className="h-5 w-24 bg-slate-200 rounded" />
                  </div>
                </div>
                <div className="h-10 w-full bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-1 space-y-4">
            <div className="animate-pulse bg-white border border-slate-100 shadow-sm rounded-xl p-5 space-y-3">
              <div className="h-5 w-1/2 bg-slate-200 rounded" />
              <div className="h-4 w-full bg-slate-200 rounded" />
              <div className="h-4 w-3/4 bg-slate-200 rounded" />
            </div>
            <div className="animate-pulse bg-white border border-slate-100 shadow-sm rounded-xl p-5 space-y-3">
              <div className="h-5 w-1/2 bg-slate-200 rounded" />
              <div className="space-y-2">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="flex justify-between">
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                    <div className="h-4 w-14 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
              <div className="h-11 w-full bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCartState() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50" dir="rtl">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
            <ShoppingCart className="h-8 w-8 text-slate-500" />
          </div>
          <h1 className="text-2xl font-bold">سلة التسوق</h1>
          <p className="text-slate-600">سلتك فارغة حالياً. استكشف منتجاتنا وأضف ما يعجبك.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="sm:w-auto w-full">
              <Link href="/">العودة للتسوق</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="sm:w-auto w-full">
              <Link href="/categories">استعراض الأقسام</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartItemRow({ item, onQuantityChange, onRemove, isPending }: { item: DetailedCartItem; onQuantityChange: (item: DetailedCartItem, change: number) => void; onRemove: (item: DetailedCartItem) => void; isPending: boolean }) {
  const hasDiscount = item.discountAmount > 0;
  const originalTotal = hasDiscount ? item.lineItemTotal + item.discountAmount : null;

  return (
    <div role="group" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="flex gap-4 sm:gap-6">
        <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 rounded-xl overflow-hidden bg-slate-50 border border-slate-200">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
          ) : (
            <div className="h-full w-full bg-slate-100 flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-slate-900 font-semibold text-base sm:text-lg truncate leading-tight">
                  {item.productName}
                </h3>
                {isPending && <Loader2 className="h-3.5 w-3.5 text-amber-600 animate-spin shrink-0" />}
              </div>

              {hasDiscount && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 border border-emerald-100 text-emerald-700 w-fit">
                  خصم
                </span>
              )}

              {item.variantTitle && (
                <div className="text-sm text-slate-600 truncate">
                  الخيار: {item.variantTitle}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end text-left shrink-0 leading-tight">
              {hasDiscount && originalTotal && (
                <div className="text-xs text-slate-500 line-through">
                  {formatPrice(item.lineItemTotal)}
                </div>
              )}
              <div className="text-lg sm:text-xl font-bold text-slate-900">
                {formatPrice(item.lineItemTotal - item.discountAmount)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-auto">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-red-700 hover:text-red-800 transition-colors disabled:opacity-60"
              onClick={() => onRemove(item)}
              disabled={isPending}
              aria-label="حذف المنتج"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span>حذف</span>
            </button>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-2 h-9">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onQuantityChange(item, -1)}
                disabled={isPending}
                aria-label="تقليل الكمية"
                className="rounded-full h-7 w-7 hover:bg-white"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="font-semibold text-slate-900 w-8 text-center text-sm">{item.quantity}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onQuantityChange(item, 1)}
                disabled={isPending}
                aria-label="زيادة الكمية"
                className="rounded-full h-7 w-7 hover:bg-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const cart = useCart();
  const router = useRouter();
  const { show: toast } = useToast();

  const [address, setAddress] = useState<string>('');
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(true);
  const [cartError, setCartError] = useState<string | null>(null);
  const [isRefreshingCart, setIsRefreshingCart] = useState(false);
  const [pendingItems, setPendingItems] = useState<Record<string, boolean>>({});

  // Delivery state
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [isCitiesLoading, setIsCitiesLoading] = useState(false);
  const [isRegionsLoading, setIsRegionsLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [isSavingRegion, setIsSavingRegion] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isWalletUpdating, setIsWalletUpdating] = useState(false);

  // Hydrate cart explicitly for better loading/error handling
  useEffect(() => {
    let active = true;
    const hydrateCart = async () => {
      setCartError(null);
      setIsCartLoading(true);
      try {
        await cartClient.fetchCart();
      } catch (e: any) {
        if (active) {
          setCartError(e?.message || 'تعذر تحميل السلة. حاول مرة أخرى.');
        }
      } finally {
        if (active) setIsCartLoading(false);
      }
    };
    hydrateCart();
    return () => {
      active = false;
    };
  }, []);

  // Sync address after cart loads - only sync during initialization to avoid cursor jumps while typing
  useEffect(() => {
    if (isInitializing && cart?.address) {
      setAddress(cart.address);
    }
    if (cart) {
      setIsCartLoading(false);
    }
  }, [cart, isInitializing]);

  // Analytics view tracking
  useEffect(() => {
    if (cart) {
      trackEvent('cart_view', {
        itemCount: cart.items.length,
        subtotal: cart.subtotal,
        total: cart.total,
      });
    }
  }, [cart]);

  // Load cities on mount
  useEffect(() => {
    let active = true;
    const loadCities = async () => {
      setIsCitiesLoading(true);
      setLocationError(null);
      try {
        const res = await fetch('/api/delivery/cities');
        if (!res.ok) throw new Error('Failed to load cities');
        const json = await res.json();
        if (!active) return;
        setCities(json.data || []);
      } catch (err) {
        if (active) setLocationError('تعذر تحميل المدن. أعد المحاولة.');
      } finally {
        if (active) setIsCitiesLoading(false);
      }
    };
    loadCities();
    return () => {
      active = false;
    };
  }, []);

  // Load regions when selectedCity changes
  useEffect(() => {
    if (!selectedCity) {
      setRegions([]);
      if (!isInitializing) {
        setSelectedRegion(null);
      }
      return;
    }
    let active = true;
    setIsRegionsLoading(true);
    setLocationError(null);
    fetch(`/api/delivery/cities/${selectedCity}/regions`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load regions');
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        const regionData = json.data || [];
        setRegions(regionData);
        if (!isInitializing) {
          setSelectedRegion(null);
        }
      })
      .catch(() => {
        if (active) setLocationError('تعذر تحميل المناطق. أعد المحاولة.');
      })
      .finally(() => {
        if (active) setIsRegionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCity, isInitializing]);

  // Initialize selected region and city from cart
  useEffect(() => {
    let active = true;
    const init = async () => {
      if (cart?.deliveryRegionId) {
        setIsRegionsLoading(true);
        setLocationError(null);
        setSelectedRegion(cart.deliveryRegionId);
        try {
          const regionRes = await fetch(`/api/delivery/regions/${cart.deliveryRegionId}`);
          if (!regionRes.ok) throw new Error('Region not found');
          const regionJson = await regionRes.json();
          const region = regionJson.data;
          if (region?.cityId) {
            setSelectedCity(region.cityId);
            const res = await fetch(`/api/delivery/cities/${region.cityId}/regions`);
            if (res.ok) {
              const json = await res.json();
              if (active && json?.data) {
                setRegions(json.data);
              }
            }
          }
        } catch (err) {
          if (active) setLocationError('تعذر تحميل بيانات التوصيل.');
        } finally {
          if (active) {
            setIsRegionsLoading(false);
            setIsInitializing(false);
          }
        }
      } else if (cart?.deliveryCityId) {
        setIsRegionsLoading(true);
        setLocationError(null);
        setSelectedCity(cart.deliveryCityId);
        setSelectedRegion(null);
        try {
          const res = await fetch(`/api/delivery/cities/${cart.deliveryCityId}/regions`);
          if (!res.ok) throw new Error('Failed to load regions');
          const json = await res.json();
          if (active) setRegions(json.data || []);
        } catch (err) {
          if (active) setLocationError('تعذر تحميل بيانات التوصيل.');
        } finally {
          if (active) {
            setIsRegionsLoading(false);
            setIsInitializing(false);
          }
        }
      } else {
        setIsInitializing(false);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [cart?.deliveryRegionId, cart?.deliveryCityId]); // Only re-run when delivery IDs change, not on address/notes updates

  const handleRefreshCart = async () => {
    setIsRefreshingCart(true);
    setCartError(null);
    try {
      await cartClient.fetchCart();
      toast({ description: 'تم تحديث السلة' });
    } catch (e) {
      setCartError('تعذر تحديث السلة. أعد المحاولة.');
      toast({ variant: 'error', description: 'تعذر تحديث السلة. أعد المحاولة.' });
    } finally {
      setIsCartLoading(false);
      setIsRefreshingCart(false);
    }
  };

  const retryLocationFetch = async () => {
    if (selectedCity) {
      setIsRegionsLoading(true);
      setLocationError(null);
      try {
        const res = await fetch(`/api/delivery/cities/${selectedCity}/regions`);
        if (!res.ok) throw new Error('Failed to load regions');
        const json = await res.json();
        setRegions(json.data || []);
      } catch {
        setLocationError('تعذر تحميل المناطق. أعد المحاولة.');
      } finally {
        setIsRegionsLoading(false);
      }
    } else {
      setIsCitiesLoading(true);
      setLocationError(null);
      try {
        const res = await fetch('/api/delivery/cities');
        if (!res.ok) throw new Error('Failed to load cities');
        const json = await res.json();
        setCities(json.data || []);
      } catch {
        setLocationError('تعذر تحميل المدن. أعد المحاولة.');
      } finally {
        setIsCitiesLoading(false);
      }
    }
  };

  const togglePending = (key: string, value: boolean) => {
    setPendingItems((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const handleQuantityChange = async (item: DetailedCartItem, change: number) => {
    const newQuantity = item.quantity + change;
    const key = item.variantId ?? item.productId;
    if (newQuantity <= 0) {
      handleRemoveItem(item);
      return;
    }
    if ((window as any).__qtyLock) return;
    (window as any).__qtyLock = true;
    togglePending(key, true);
    try {
      if (item.variantId) {
        await cartClient.updateItemQuantity({ variantId: item.variantId, quantity: newQuantity });
      } else {
        await cartClient.updateItemQuantity({ productId: item.productId, quantity: newQuantity });
      }
    } catch (e) {
      toast({ variant: 'error', description: 'تعذر تحديث الكمية. حاول مرة أخرى.' });
    } finally {
      setTimeout(() => {
        (window as any).__qtyLock = false;
      }, 200);
      togglePending(key, false);
    }
  };

  const handleRemoveItem = async (item: DetailedCartItem) => {
    const key = item.variantId ?? item.productId;
    togglePending(key, true);
    try {
      if (item.variantId) {
        await cartClient.removeItem({ variantId: item.variantId });
      } else {
        await cartClient.removeItem({ productId: item.productId });
      }
      toast({ description: 'تم حذف المنتج من السلة' });
    } catch (e) {
      toast({ variant: 'error', description: 'تعذر حذف المنتج. حاول مرة أخرى.' });
    } finally {
      togglePending(key, false);
    }
  };

  const handleCityChange = (cityId: string) => {
    setIsInitializing(false);
    setSelectedCity(cityId);
    setSelectedRegion(null);
    trackEvent('select_city', { cityId });
  };

  // Auto-save delivery details when city/region changes (Immediate, but don't trigger on address change)
  useEffect(() => {
    if (isInitializing) return;
    if (!selectedCity || !address.trim()) return;
    let active = true;
    const save = async () => {
      setIsSavingRegion(true);
      try {
        if (regions.length > 0 && !selectedRegion) {
          return;
        }
        if (selectedRegion) {
          await cartClient.updateDetails({
            deliveryRegionId: selectedRegion,
            deliveryCityId: null,
            address,
          });
        } else if (regions.length === 0 && selectedCity) {
          await cartClient.updateDetails({
            deliveryCityId: selectedCity,
            deliveryRegionId: null,
            address,
          });
        }
      } catch (e) {
        toast({ variant: 'error', description: 'تعذر حفظ بيانات التوصيل.' });
      } finally {
        if (active) setIsSavingRegion(false);
      }
    };
    save();
    return () => {
      active = false;
    };
  }, [selectedCity, selectedRegion, regions.length, isInitializing, toast]); // Removed 'address' from dependencies to avoid immediate save on every keystroke

  // Debounced auto-save on address changes
  useEffect(() => {
    if (isInitializing) return;
    if (!selectedCity) return;
    const trimmed = address.trim();
    const timer = setTimeout(async () => {
      if (!trimmed) return;
      setIsSavingRegion(true);
      try {
        if (regions.length > 0 && !selectedRegion) return;
        if (selectedRegion) {
          await cartClient.updateDetails({ deliveryRegionId: selectedRegion, deliveryCityId: null, address: trimmed });
        } else if (regions.length === 0) {
          await cartClient.updateDetails({ deliveryCityId: selectedCity!, deliveryRegionId: null, address: trimmed });
        }
      } catch (e) {
        toast({ variant: 'error', description: 'تعذر حفظ العنوان. حاول مرة أخرى.' });
      } finally {
        setIsSavingRegion(false);
      }
    }, 1000); // Increased debounce to 1000ms
    return () => clearTimeout(timer);
  }, [address, selectedCity, selectedRegion, regions.length, isInitializing, toast]);

  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const handleProceedToPayment = async () => {
    try {
      setIsCreatingOrder(true);
      if (!selectedCity || !address.trim() || (regions.length > 0 && !selectedRegion)) {
        toast({ variant: 'error', description: 'أكمل بيانات التوصيل قبل المتابعة.' });
        setIsCreatingOrder(false);
        return;
      }
      const { orderId, fullyPaid } = await cartClient.createOrder();
      trackEvent('checkout_start', { orderId, cityId: selectedCity, regionId: selectedRegion });

      // If fully paid by wallet, we can still redirect to checkout which will handle the 0 amount
      // Handle fullyPaid case so user doesnt have to choose a payment method
      if (fullyPaid) {
        toast({ description: 'تم إنشاء الطلب وجاري الدفع من المحفظة.' });
        try {
          const result = await cartClient.initiatePayment(orderId, "wallet");
          router.push(`/checkout/complete?paymentId=${result.paymentId}`);
        } catch (paymentErr) {
          toast({ variant: 'error', description: 'حدث خطأ في استكمال عملية الدفع بالمحفظة' });
          router.push(`/checkout/${orderId}`);
        }
      } else {
        toast({ description: 'تم إنشاء الطلب، جاري تحويلك للدفع.' });
        router.push(`/checkout/${orderId}`);
      }
    } catch (error: any) {
      toast({ variant: 'error', description: error?.message || 'حدث خطأ أثناء إنشاء الطلب.' });
      setIsCreatingOrder(false);
    }
  };

  const handleWalletToggle = async (checked: boolean) => {
    setIsWalletUpdating(true);
    try {
      await cartClient.updateDetails({ useWallet: checked });
    } catch (e) {
      toast({ variant: 'error', description: 'حدث خطأ أثناء تحديث إعدادات المحفظة.' });
    } finally {
      setIsWalletUpdating(false);
    }
  };

  if (isCartLoading) {
    return <CartSkeleton />;
  }

  if (cartError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50" dir="rtl">
        <div className="container mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-3 bg-white border border-amber-200 text-amber-800 px-4 py-3 rounded-xl shadow-sm">
            <AlertCircle className="h-5 w-5" />
            <span>{cartError}</span>
          </div>
          <Button onClick={handleRefreshCart} size="lg" disabled={isRefreshingCart}>
            {isRefreshingCart && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            أعد المحاولة
          </Button>
          <Button asChild variant="outline">
            <Link href="/">العودة للتسوق</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return <EmptyCartState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50" dir="rtl">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">سلة التسوق</h1>
            <p className="text-slate-600 text-sm sm:text-base">راجع محتويات سلتك وأكمل بيانات التوصيل بسهولة.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
            <Badge variant="secondary" className="flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" />
              {cart.items.length} منتج
            </Badge>
            <Badge className="flex items-center gap-1">
              <Truck className="h-4 w-4" />
              توصيل سريع داخل المناطق المدعومة
            </Badge>
            <Button variant="outline" size="sm" onClick={handleRefreshCart} disabled={isRefreshingCart} className="flex items-center gap-2">
              {isRefreshingCart ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              تحديث
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => {
              const key = item.variantId ?? item.productId;
              return (
                <CartItemRow
                  key={key}
                  item={item}
                  onQuantityChange={handleQuantityChange}
                  onRemove={handleRemoveItem}
                  isPending={!!pendingItems[key]}
                />
              );
            })}
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2 text-slate-900">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">تحديد موقع التوصيل</h2>
                </div>
                {isSavingRegion && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-1 flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    جاري الحفظ
                  </span>
                )}
              </div>

              {locationError && (
                <div className="flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{locationError}</span>
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={retryLocationFetch}>
                    إعادة المحاولة
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    المدينة
                    {isCitiesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </label>
                  <Popover open={isCityOpen} onOpenChange={setIsCityOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isCityOpen}
                        disabled={isCitiesLoading}
                        className={cn("w-full justify-between font-normal", !selectedCity && "text-slate-500")}
                      >
                        {selectedCity
                          ? cities.find((city) => city.id === selectedCity)?.name
                          : "اختر المدينة"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="ابحث عن مدينة..." />
                        <CommandList>
                          <CommandEmpty>لم يتم العثور على مدينة.</CommandEmpty>
                          <CommandGroup>
                            {cities.map((city) => (
                              <CommandItem
                                key={city.id}
                                value={city.name}
                                onSelect={() => {
                                  handleCityChange(city.id);
                                  setIsCityOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCity === city.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {city.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    المنطقة (إن وجدت)
                    {isRegionsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  </label>
                  {regions.length > 0 ? (
                    <Popover open={isRegionOpen} onOpenChange={setIsRegionOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isRegionOpen}
                          disabled={!selectedCity || isRegionsLoading}
                          className={cn("w-full justify-between font-normal", !selectedRegion && "text-slate-500")}
                        >
                          {selectedRegion
                            ? regions.find((region) => region.id === selectedRegion)?.name
                            : "اختر المنطقة"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="ابحث عن منطقة..." />
                          <CommandList>
                            <CommandEmpty>لم يتم العثور على منطقة.</CommandEmpty>
                            <CommandGroup>
                              {regions.map((region) => (
                                <CommandItem
                                  key={region.id}
                                  value={region.name}
                                  onSelect={() => {
                                    setSelectedRegion(region.id);
                                    trackEvent('select_region', { regionId: region.id, cityId: selectedCity });
                                    setIsRegionOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedRegion === region.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {region.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : selectedCity ? (
                    <div className="text-sm text-slate-600 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                      هذه المدينة لا تحتوي على مناطق فرعية
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                      اختر مدينة أولاً لعرض المناطق
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">العنوان التفصيلي</label>
                  <Textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="أدخل عنوان التوصيل بالتفصيل"
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    يتم الحفظ تلقائياً عند تغيير البيانات
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 sm:p-6 sticky top-20 space-y-4">
              <div className="flex items-center gap-2 text-slate-900">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">ملخص الطلب</h2>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span>المجموع الفرعي</span>
                  <span className="font-semibold text-slate-900">{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>رسوم التوصيل</span>
                  <span className="font-semibold text-slate-900">{formatPrice(cart.deliveryFee)}</span>
                </div>
                {cart.discountTotal > 0 && (
                  <div className="flex justify-between text-red-700">
                    <span>إجمالي الخصومات</span>
                    <span>-{formatPrice(cart.discountTotal)}</span>
                  </div>
                )}
                {cart.deliveryDiscountAmount > 0 && (
                  <div className="flex justify-between text-red-700">
                    <span>خصم التوصيل</span>
                    <span>-{formatPrice(cart.deliveryDiscountAmount)}</span>
                  </div>
                )}

                {cart.walletBalance > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="use-wallet"
                          checked={cart.useWallet || false}
                          onCheckedChange={handleWalletToggle}
                          disabled={isWalletUpdating || isCreatingOrder}
                        />
                        <Label htmlFor="use-wallet" className="cursor-pointer">
                          إستخدام المحفظة ({formatPrice(cart.walletBalance)})
                        </Label>
                      </div>
                    </div>
                  </>
                )}

                {cart.walletAmountUsed > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>مدفوع من المحفظة</span>
                    <span>-{formatPrice(cart.walletAmountUsed)}</span>
                  </div>
                )}

                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-lg text-slate-900">
                  <span>الإجمالي المطلوب دفعه</span>
                  <span>{formatPrice(cart.payableTotal ?? cart.total)}</span>
                </div>
                <div className="text-xs text-slate-500">
                  يشمل السعر أي خصومات أو عروض مفعلة على المنتجات أو التوصيل.
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleProceedToPayment}
                disabled={isCreatingOrder || !selectedCity || !address.trim() || (regions.length > 0 && !selectedRegion) || cart.deliveryFee === 0}
              >
                {isCreatingOrder ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري معالجة الطلب
                  </div>
                ) : (
                  'المتابعة للدفع'
                )}
              </Button>
              <p className="text-xs text-slate-500 text-center">
                سيتم تحويلك لبوابة الدفع بعد إنشاء الطلب مباشرة.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
