"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import { WidgetFieldProps } from './types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info } from 'lucide-react';

// ── Admin Fields (shared by all 3 personalized widget types) ──

function PersonalizedWidgetFields({ control, namePrefix }: WidgetFieldProps) {
    const titleField = `${namePrefix}.title` as const;
    const limitField = `${namePrefix}.limit` as const;
    const layoutField = `${namePrefix}.layout` as const;

    return (
        <div className="space-y-4" dir="rtl">
            <div>
                <Label htmlFor={titleField}>العنوان</Label>
                <Controller
                    control={control}
                    name={titleField}
                    render={({ field }) => (
                        <Input
                            id={titleField}
                            value={field.value || ''}
                            onChange={field.onChange}
                            placeholder="مثال: شاهدته مؤخراً"
                        />
                    )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor={limitField}>عدد المنتجات</Label>
                    <Controller
                        control={control}
                        name={limitField}
                        render={({ field }) => (
                            <Input
                                id={limitField}
                                type="number"
                                min={1}
                                max={24}
                                value={field.value ?? 8}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 8)}
                            />
                        )}
                    />
                </div>

                <div>
                    <Label htmlFor={layoutField}>التخطيط</Label>
                    <Controller
                        control={control}
                        name={layoutField}
                        render={({ field }) => (
                            <Select value={field.value || 'grid'} onValueChange={field.onChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="grid">شبكة</SelectItem>
                                    <SelectItem value="slider">سلايدر</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>
        </div>
    );
}

// ── Admin Preview / Storefront Renderer ──

function PersonalizedWidgetPreview({ widget, subtitle }: { widget: any, subtitle: string }) {
    const data = widget.data || {};
    const title = data.title || 'عنوان';
    const limit = data.limit || 8;
    const fetchedData = widget.fetchedData;

    // Storefront: render real products if fetchedData is populated by RSC
    if (fetchedData && Array.isArray(fetchedData) && fetchedData.length > 0) {
        return (
            <div className="py-6 px-4" dir="rtl">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {title}
                </h2>
                <div className={data.layout === 'slider'
                    ? 'flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 -mx-4 px-4'
                    : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'
                }>
                    {fetchedData.map((product: any) => (
                        <a
                            key={product.id}
                            href={`/products/${product.slug}`}
                            className={`group block ${data.layout === 'slider' ? 'flex-none w-[45%] sm:w-[30%] md:w-[22%] snap-start' : ''}`}
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
                            {product.price && (
                                <span className="text-sm font-bold text-gray-900 mt-1 block">
                                    {parseFloat(product.price).toFixed(2)} د.ل
                                </span>
                            )}
                        </a>
                    ))}
                </div>
            </div>
        );
    }

    // Storefront: guest login prompt for Buy Again
    if (fetchedData === null && widget.type === 'buy_again') {
        return (
            <div className="py-8 px-4" dir="rtl">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
                <div className="text-center py-8 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border border-gray-100">
                    <p className="text-3xl mb-2">🔒</p>
                    <p className="text-gray-600 font-medium">سجّل دخولك لرؤية منتجاتك</p>
                    <a
                        href="/login"
                        className="inline-block mt-3 px-6 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-colors"
                    >
                        تسجيل الدخول
                    </a>
                </div>
            </div>
        );
    }

    // Admin: skeleton placeholder preview
    return (
        <div className="py-6 px-4" dir="rtl">
            <div className="mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <p className="text-xs text-gray-500">{subtitle}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <div className="aspect-square rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
                        <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
                    </div>
                ))}
            </div>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-blue-500 mt-4 bg-blue-50/50 py-2 rounded-lg border border-blue-100">
                <Info className="w-4 h-4" /> يتم تحديد المنتجات تلقائياً لكل مستخدم
            </p>
        </div>
    );
}

// ── Recently Viewed ──

function RecentlyViewedPreview({ widget }: { widget: any }) {
    return <PersonalizedWidgetPreview widget={widget} subtitle="المنتجات التي شاهدها الزائر" />;
}

export const recentlyViewedDefinition = {
    Fields: PersonalizedWidgetFields,
    Preview: RecentlyViewedPreview,
};

// ── Buy Again ──

function BuyAgainPreview({ widget }: { widget: any }) {
    return <PersonalizedWidgetPreview widget={widget} subtitle="المنتجات التي اشتراها سابقاً" />;
}

export const buyAgainDefinition = {
    Fields: PersonalizedWidgetFields,
    Preview: BuyAgainPreview,
};

// ── Recommended For You ──

function RecommendedForYouPreview({ widget }: { widget: any }) {
    return <PersonalizedWidgetPreview widget={widget} subtitle="توصيات مخصصة بناءً على اهتماماته" />;
}

export const recommendedForYouDefinition = {
    Fields: PersonalizedWidgetFields,
    Preview: RecommendedForYouPreview,
};

// ── Trending Near You ──

function TrendingNearYouPreview({ widget }: { widget: any }) {
    return <PersonalizedWidgetPreview widget={widget} subtitle="المنتجات الرائجة في منطقة الزائر" />;
}

export const trendingNearYouDefinition = {
    Fields: PersonalizedWidgetFields,
    Preview: TrendingNearYouPreview,
};
