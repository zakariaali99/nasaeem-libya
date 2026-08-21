"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import Select from 'react-select';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/ui/ProductCard';
import { Product } from '@/modules/products/types/productTypes';
import { CollectionShowcaseWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';

export const CollectionShowcaseFields: React.FC<WidgetFieldProps> = ({ control, namePrefix, collectionOptions = [], rtlSelectStyles }) => (
  <div className="space-y-2">
    <Controller
      name={`${namePrefix}.layout`}
      control={control}
      render={({ field }) => (
        <div className="space-y-1">
          <label className="block text-sm font-medium">طريقة العرض</label>
          <select {...field} className="w-full border rounded p-2">
            <option value="grid">شبكة</option>
            <option value="slider">سلايدر</option>
          </select>
          <p className="text-xs text-gray-500">يتغير عرض المنتجات حسب الحجم المتاح.</p>
        </div>
      )}
    />
    <Controller
      name={`${namePrefix}.collectionId`}
      control={control}
      render={({ field }) => (
        <Select
          options={collectionOptions}
          value={collectionOptions.find((opt) => opt.value === field.value) || null}
          onChange={(opt) => field.onChange((opt as any)?.value || '')}
          styles={rtlSelectStyles}
          classNamePrefix="react-select"
          placeholder="اختر المجموعة"
        />
      )}
    />
  </div>
);

const CollectionShowcasePreview: React.FC<{ widget: CollectionShowcaseWidget }> = ({ widget }) => {
  const fetchedData = widget.fetchedData as { collection: { name: string }, products: Product[] } | undefined;

  // Ensure we have a safe array for products from fetched data
  const safeFetchedProducts = (fetchedData && Array.isArray(fetchedData.products)) ? fetchedData.products : [];

  const { data: collInfo, isLoading: loadingInfo } = useQuery<{ name: string }, Error>({
    queryKey: ['collection-info', widget.data.collectionId],
    queryFn: async () => {
      const res = await fetch(`/api/collections/${widget.data.collectionId}`);
      if (!res.ok) throw new Error('فشل جلب معلومات المجموعة');
      return res.json() as Promise<{ name: string }>;
    },
    enabled: !fetchedData?.collection && !!widget.data.collectionId,
    initialData: fetchedData?.collection,
  });

  const { data: prodRes, isLoading: loadingProds } = useQuery<{ products: Product[] }, Error>({
    queryKey: ['collection-products', widget.data.collectionId],
    queryFn: async () => {
      const res = await fetch(`/api/collections/${widget.data.collectionId}/products`);
      if (!res.ok) throw new Error('فشل جلب منتجات المجموعة');
      return res.json() as Promise<{ products: Product[] }>;
    },
    enabled: !fetchedData?.products && !!widget.data.collectionId,
    initialData: safeFetchedProducts.length > 0 ? { products: safeFetchedProducts } : undefined,
  });

  if (loadingInfo || loadingProds || !collInfo || !prodRes) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-gray-200 rounded"></div>
      </div>
    );
  }

  const layout = widget.data.layout === 'slider' ? 'slider' : 'grid';

  return (
    <div>
      <h3 className="font-bold text-2xl mb-4 text-center">{collInfo.name}</h3>
      {layout === 'slider' ? (
        <div className="flex flex-nowrap overflow-x-auto gap-7 lg:gap-9 xl:gap-12 2xl:gap-16 pb-2 snap-x snap-mandatory" dir="rtl">
          {(prodRes.products || []).map((prod) => {
            const imageUrl = prod.images?.[0]?.url || '';
            return (
              <div key={prod.id} className="shrink-0 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 snap-start min-w-[240px]">
                <ProductCard
                  name={prod.name}
                  price={prod.price}
                  imageUrl={imageUrl}
                  slug={prod.slug}
                  discounts={prod.discounts}
                  productId={prod.id}
                  hasVariants={prod.hasVariants}
                  availableQuantity={prod.trackQuantity ? (prod.hasVariants ? null : (prod.stock ?? 0)) : null}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-7 lg:gap-9 xl:gap-12 2xl:gap-16 items-stretch">
          {(prodRes.products || []).map((prod) => {
            const imageUrl = prod.images?.[0]?.url || '';
            return (
              <div key={prod.id} className="h-full">
                <ProductCard
                  name={prod.name}
                  price={prod.price}
                  imageUrl={imageUrl}
                  slug={prod.slug}
                  discounts={prod.discounts}
                  productId={prod.id}
                  hasVariants={prod.hasVariants}
                  availableQuantity={prod.trackQuantity ? (prod.hasVariants ? null : (prod.stock ?? 0)) : null}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const CollectionShowcasePreviewRenderer: WidgetPreviewRenderer<CollectionShowcaseWidget> = ({ widget }) => (
  <CollectionShowcasePreview widget={widget} />
);

export const collectionShowcaseDefinition = {
  type: WidgetType.COLLECTION_SHOWCASE,
  Fields: CollectionShowcaseFields,
  Preview: CollectionShowcasePreviewRenderer,
};
