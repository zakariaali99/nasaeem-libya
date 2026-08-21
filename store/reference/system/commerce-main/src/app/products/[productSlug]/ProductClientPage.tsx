'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Product } from '@/modules/products/types/productTypes';
import { ProductVariantWithImages } from '@/modules/variants/types/variantTypes';
import { OptionWithValues } from '@/modules/options/types/optionTypes';
import { cn } from '@/lib/utils';
import { ImageOff, Heart, Share2 } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { AddToCartButton } from '@/components/AddToCartButton';
import { trackProductView, trackEvent, trackProductEngagement } from '@/modules/analytics/client/analyticsClient';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// Helper to ensure full quality image
const getFullImageUrl = (url: string) => {
  if (!url) return '';
  return url.replace(/\/(medium|thumbnail|large)\//, '/full/');
};

interface ProductClientPageProps {
  product: Product;
  initialVariants: ProductVariantWithImages[];
  options: OptionWithValues[];
  children?: React.ReactNode;
}

export default function ProductClientPage({ product, initialVariants, options, children }: ProductClientPageProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantWithImages | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (product.hasVariants && options.length > 0) {
      const defaultOptions: Record<string, string> = {};
      options.forEach(option => {
        if (option.values.length > 0) {
          defaultOptions[option.id] = option.values[0].id;
        }
      });
      return defaultOptions;
    }
    return {};
  });
  const cart = useCart();

  // Sync default selection with cart if this product has a variant in cart
  useEffect(() => {
    if (!product.hasVariants) return;
    const cartItem = cart?.items.find(i => i.variantId && initialVariants.some(v => v.id === i.variantId));
    if (cartItem) {
      const variantInCart = initialVariants.find(v => v.id === cartItem.variantId) || null;
      setSelectedVariant(variantInCart);
      if (variantInCart) {
        // Build options map from variant's values
        const variantValues = variantInCart.optionValues ?? variantInCart.options ?? [];
        const opts: Record<string, string> = {};
        variantValues.forEach(v => { opts[v.optionId] = v.valueId; });
        setSelectedOptions(opts);
      }
    }
  }, [cart, initialVariants, product.hasVariants]);

  useEffect(() => {
    // Function to find a variant that matches the selected options
    const findMatchingVariant = () => {
      if (!product.hasVariants) {
        setSelectedVariant(initialVariants.length > 0 ? initialVariants[0] : null);
        return;
      }

      if (Object.keys(selectedOptions).length < options.length) {
        setSelectedVariant(null);
        return;
      }

      const matchingVariant = initialVariants.find(variant => {
        // Support both `optionValues` (client type) and `options` (server field)
        const variantValues = variant.optionValues ?? variant.options ?? [];
        return Object.entries(selectedOptions).every(([optionId, valueId]) =>
          variantValues.some(v => v.optionId === optionId && v.valueId === valueId)
        );
      });

      setSelectedVariant(matchingVariant || null);
    };

    findMatchingVariant();
  }, [selectedOptions, initialVariants, options, product.hasVariants]);

  const [mainImage, setMainImage] = useState('');

  useEffect(() => {
    if (selectedVariant) {
      setMainImage(getFullImageUrl(selectedVariant.images?.[0]?.url || '') || getFullImageUrl(product.images?.[0]?.url || '') || '');
    } else if (!product.hasVariants) {
      // For products without variants, use the main product image
      setMainImage(getFullImageUrl(product.images?.[0]?.url || '') || '');
    }
  }, [selectedVariant, product.images, product.hasVariants]);

  // Initial sync for products without variants or pre-selected state
  useEffect(() => {
    if (!mainImage && product.images && product.images.length > 0) {
      setMainImage(getFullImageUrl(product.images[0].url));
    }
  }, [product.images, mainImage]);


  const displayedImages = useMemo(() => {
    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 0) {
      return selectedVariant.images;
    }
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    return [];
  }, [selectedVariant, product.images]);

  useEffect(() => {
    const alreadyTracked = (window as any).__productTrackedId;
    if (alreadyTracked === product.id) return;
    (window as any).__productTrackedId = product.id;
    trackProductView(product.id, {
      hasVariants: product.hasVariants,
      slug: product.slug,
      price: product.price,
    });
    if (product.description) {
      trackProductEngagement('description_available', { productId: product.id });
    }
    if (product.width != null || product.length != null || product.height != null || product.weight != null) {
      trackProductEngagement('specs_available', { productId: product.id });
    }
  }, [product.id, product.hasVariants, product.slug, product.price]);

  useEffect(() => {
    if (selectedVariant) {
      trackEvent('select_variant', { productId: product.id, variantId: selectedVariant.id });
    }
  }, [selectedVariant, product.id]);

  const formattedPrice = useMemo(() => {
    const price = selectedVariant?.price ?? (product.hasVariants ? null : product.price);
    return price != null
      ? price.toLocaleString('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0 })
      : 'إختر المواصفات';
  }, [selectedVariant, product.price, product.hasVariants]);

  // Determine available stock quantity when trackQuantity is enabled; unlimited otherwise
  const availableQuantity = product.trackQuantity
    ? (product.hasVariants
      ? selectedVariant?.inventoryQuantity ?? 0
      : product.stock ?? 0)
    : null;

  const isOutOfStock = availableQuantity !== null && availableQuantity === 0;

  // Calculate discount percentage if needed (assuming comparable_price exists in future, placeholder for now)
  const discountPercentage = null;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

          {/* Left Column: Image Gallery (Sticky on Desktop) */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-24">
            <div className="relative w-full aspect-square bg-muted rounded-xl overflow-hidden shadow-sm border border-border/50">
              {discountPercentage && (
                <Badge className="absolute top-4 right-4 z-10 px-3 py-1 text-sm bg-red-500 hover:bg-red-600">
                  خصم {discountPercentage}%
                </Badge>
              )}
              {mainImage ? (
                <Image
                  src={mainImage}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  priority
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                  <ImageOff size={64} strokeWidth={1.5} />
                  <span className="mt-4 text-lg font-medium">لا توجد صورة متاحة</span>
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {displayedImages.length > 1 && (
              <ScrollArea className="w-full whitespace-nowrap pb-2">
                <div className="flex space-x-4 space-x-reverse px-1">
                  {displayedImages.map((image) => (
                    <button
                      key={image.id}
                      className={cn(
                        'relative w-24 h-24 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0',
                        getFullImageUrl(mainImage) === getFullImageUrl(image.url)
                          ? 'border-primary ring-2 ring-primary/20 shadow-md'
                          : 'border-border hover:border-primary/50 opacity-80 hover:opacity-100'
                      )}
                      onClick={() => {
                        setMainImage(getFullImageUrl(image.url));
                        trackProductEngagement('gallery_thumbnail', { productId: product.id, imageId: image.id });
                      }}
                    >
                      <Image
                        src={image.url}
                        alt={image.altText || product.name}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Right Column: Product Details */}
          <div className="flex flex-col space-y-8 lg:py-2">

            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">{product.name}</h1>
                {/* Action Icons */}
                <div className="flex items-center gap-2">
                  {/* <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted text-muted-foreground">
                    <Share2 size={20} />
                  </Button>
                  {/* Future Wishlist Feature */}
                  {/* <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted text-muted-foreground">
                    <Heart size={20} />
                  </Button>  */}
                </div>
              </div>

              <div className="flex items-baseline gap-4">
                <p className="text-3xl font-bold text-primary">{formattedPrice}</p>
                {/* Placeholder for old price if exists in future */}
                {/* <span className="text-lg text-muted-foreground line-through">120 د.ل</span> */}
              </div>

              {/* Reviews Summary Placeholder - Can be dynamic later */}
              {/* <div className="flex items-center gap-2">
                        <div className="flex text-yellow-400">
                             {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                        </div>
                        <span className="text-sm text-muted-foreground">(4.8 تقييم)</span>
                   </div> */}
            </div>

            <Separator />

            {/* Variant Selection */}
            {product.hasVariants && options.length > 0 && (
              <div className="space-y-6">
                {options.map((option) => (
                  <div key={option.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-foreground">{option.name}:</h3>
                      <span className="text-sm text-muted-foreground font-medium">
                        {selectedOptions[option.id]
                          ? option.values.find(v => v.id === selectedOptions[option.id])?.value
                          : 'اختر خياراً'}
                      </span>
                    </div>
                    <RadioGroup
                      dir="rtl"
                      value={selectedOptions[option.id]}
                      onValueChange={(valueId) => {
                        const newSelectedOptions = { ...selectedOptions, [option.id]: valueId };
                        setSelectedOptions(newSelectedOptions);
                      }}
                      className="flex flex-wrap gap-3"
                    >
                      {option.values.map((value) => (
                        <div key={value.id}>
                          <RadioGroupItem value={value.id} id={`${option.id}-${value.id}`} className="sr-only peer" />
                          <Label
                            htmlFor={`${option.id}-${value.id}`}
                            className="flex items-center justify-center rounded-full border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-all hover:bg-muted hover:text-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer min-w-[3rem]"
                          >
                            {value.value}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-4 pt-4">
              {isOutOfStock ? (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <span className="text-muted-foreground font-medium">هذا المنتج غير متوفر حالياً</span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <AddToCartButton
                    productId={product.id}
                    variantId={selectedVariant?.id}
                    availableQuantity={availableQuantity}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Info Sections (Server Rendered Passed as Children) */}
            <div className="space-y-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

