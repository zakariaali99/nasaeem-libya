'use client';

import { Product } from '@/modules/products/types/productTypes';
import { ProductCard } from '@/components/ui/ProductCard';
import { trackEvent } from '@/modules/analytics/client/analyticsClient';

interface RelatedProductsSectionProps {
    relatedProducts: Product[];
    currentProductId: string;
}

export function RelatedProductsSection({ relatedProducts, currentProductId }: RelatedProductsSectionProps) {
    if (!relatedProducts || relatedProducts.length === 0) return null;

    return (
        <div className="mt-16 lg:mt-24 border-t pt-16">
            <div className="flex flex-col items-center text-center mb-10 space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">قد يعجبك أيضاً</h2>
                <p className="text-muted-foreground max-w-2xl">منتجات مختارة بعناية لتكمل تجربتك</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedProducts.map((rp) => {
                    const imageUrl = rp.images?.[0]?.url ?? '';
                    return (
                        <div key={rp.id} onClick={() => trackEvent('related_product_click', { productId: currentProductId, relatedId: rp.id })}>
                            <ProductCard
                                name={rp.name}
                                price={rp.price}
                                imageUrl={imageUrl}
                                slug={rp.slug}
                                discounts={rp.discounts}
                                productId={rp.id}
                                hasVariants={rp.hasVariants}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
