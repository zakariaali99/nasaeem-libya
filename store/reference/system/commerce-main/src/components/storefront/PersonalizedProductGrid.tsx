import React from 'react';
import Link from 'next/link';

interface PersonalizedProduct {
    id: string;
    name: string;
    slug: string;
    price: string | null;
    compareAtPrice?: string | null;
    imageUrl?: string;
}

interface PersonalizedProductGridProps {
    title: string;
    products: PersonalizedProduct[];
    layout: 'grid' | 'slider';
    emptyMessage?: string;
    showLoginPrompt?: boolean;
}

/**
 * Server-rendered product grid for personalized widgets.
 * Renders fetchedData products in a responsive grid or slider layout.
 * No client JS shipped — this is pure RSC.
 */
export default function PersonalizedProductGrid({
    title,
    products,
    layout,
    emptyMessage,
    showLoginPrompt = false,
}: PersonalizedProductGridProps) {
    if (showLoginPrompt) {
        return (
            <div className="py-8 px-4" dir="rtl">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
                <div className="text-center py-8 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border border-gray-100">
                    <p className="text-3xl mb-2">🔒</p>
                    <p className="text-gray-600 font-medium">سجّل دخولك لرؤية اقتراحاتك الشخصية</p>
                    <Link
                        href="/login"
                        className="inline-block mt-3 px-6 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-colors"
                    >
                        تسجيل الدخول
                    </Link>
                </div>
            </div>
        );
    }

    if (!products || products.length === 0) {
        if (emptyMessage) {
            return (
                <div className="py-6 px-4 text-center text-gray-500" dir="rtl">
                    <p>{emptyMessage}</p>
                </div>
            );
        }
        return null; // Don't render empty widgets
    }

    const formatPrice = (price: string | null) => {
        if (!price) return '';
        const num = parseFloat(price);
        return isNaN(num) ? price : `${num.toFixed(2)} د.ل`;
    };

    const gridClass = layout === 'slider'
        ? 'flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 -mx-4 px-4'
        : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4';

    const itemClass = layout === 'slider'
        ? 'flex-none w-[45%] sm:w-[30%] md:w-[22%] snap-start'
        : '';

    return (
        <div className="py-6 px-4" dir="rtl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
            <div className={gridClass}>
                {products.map((product) => (
                    <Link
                        key={product.id}
                        href={`/products/${product.slug}`}
                        className={`group block ${itemClass}`}
                    >
                        <div className="overflow-hidden rounded-xl bg-gray-50 aspect-square mb-2">
                            {product.imageUrl ? (
                                <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                    <span className="text-3xl text-gray-300">📦</span>
                                </div>
                            )}
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {product.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold text-gray-900">
                                {formatPrice(product.price)}
                            </span>
                            {product.compareAtPrice && parseFloat(product.compareAtPrice) > 0 && (
                                <span className="text-xs text-gray-400 line-through">
                                    {formatPrice(product.compareAtPrice)}
                                </span>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
