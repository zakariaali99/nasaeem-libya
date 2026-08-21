"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import AsyncSelect from 'react-select/async';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { ProductCard } from '@/components/ui/ProductCard';
import { Product } from '@/modules/products/types/productTypes';
import { ProductListWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';

const ProductSelector = ({
  value,
  onChange,
  rtlSelectStyles
}: {
  value: string[];
  onChange: (val: string[]) => void;
  rtlSelectStyles?: any;
}) => {
  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products-details', value],
    queryFn: async () => {
      if (!value || value.length === 0) return { data: [] };
      const params = new URLSearchParams();
      params.append('ids', value.join(','));
      params.append('limit', '100');
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) return { data: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: !!value && value.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const loadOptions = async (inputValue: string) => {
    const params = new URLSearchParams();
    if (inputValue) params.append('search', inputValue);
    params.append('limit', '20');

    try {
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      const items = json.data?.data || [];
      return items.map((p: Product) => ({
        value: p.id,
        label: p.name,
      }));
    } catch (e) {
      return [];
    }
  };

  const selectedProducts = productsData?.data || [];
  const valueOptions = selectedProducts.map((p: Product) => ({
    value: p.id,
    label: p.name
  }));

  // Preserve order based on value array if possible, or just default
  // Ideally we want to show them in the order of 'value'
  const orderedOptions = (value || [])
    .map(id => valueOptions.find(opt => opt.value === id))
    .filter((opt): opt is { value: string; label: string } => !!opt);

  return (
    <AsyncSelect
      isMulti
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
      value={orderedOptions}
      onChange={(opts: any) => onChange(opts.map((o: any) => o.value))}
      styles={rtlSelectStyles}
      classNamePrefix="react-select"
      placeholder="ابحث عن المنتجات..."
      noOptionsMessage={() => "لا توجد نتائج"}
      loadingMessage={() => "جاري البحث..."}
    />
  );
};

export const ProductListFields: React.FC<WidgetFieldProps> = ({ control, namePrefix, rtlSelectStyles }) => (
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
          <p className="text-xs text-gray-500">على الجوال سيتم عرض منتجين في الصف دائمًا.</p>
        </div>
      )}
    />
    <Controller
      name={`${namePrefix}.title`}
      control={control}
      render={({ field }) => (
        <Input {...field} placeholder="عنوان القائمة" />
      )}
    />
    <Controller
      name={`${namePrefix}.productIds`}
      control={control}
      render={({ field }) => (
        <ProductSelector
          value={field.value}
          onChange={field.onChange}
          rtlSelectStyles={rtlSelectStyles}
        />
      )}
    />
  </div>
);

const ProductsGrid: React.FC<{ products: Product[] }> = ({ products }) => (
  <div>
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-7 lg:gap-9 xl:gap-12 2xl:gap-16 items-stretch">
      {products.map((prod) => (
        <div key={prod.id} className="h-full">
          <ProductCard
            name={prod.name}
            price={prod.price}
            imageUrl={prod.images && prod.images[0]?.url ? prod.images[0].url : ''}
            slug={prod.slug}
            discounts={prod.discounts}
            productId={prod.id}
            hasVariants={prod.hasVariants}
            availableQuantity={prod.trackQuantity ? (prod.hasVariants ? null : (prod.stock ?? 0)) : null}
          />
        </div>
      ))}
    </div>
  </div>
);

const ProductsSlider: React.FC<{ products: Product[] }> = ({ products }) => (
  <div>
    <div className="flex flex-nowrap overflow-x-auto gap-7 lg:gap-9 xl:gap-12 2xl:gap-16 pb-2 snap-x snap-mandatory" dir="rtl">
      {products.map((prod) => (
        <div key={prod.id} className="shrink-0 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 snap-start min-w-[240px]">
          <ProductCard
            name={prod.name}
            price={prod.price}
            imageUrl={prod.images && prod.images[0]?.url ? prod.images[0].url : ''}
            slug={prod.slug}
            discounts={prod.discounts}
            productId={prod.id}
            hasVariants={prod.hasVariants}
            availableQuantity={prod.trackQuantity ? (prod.hasVariants ? null : (prod.stock ?? 0)) : null}
          />
        </div>
      ))}
    </div>
  </div>
);

export const ProductListPreviewRenderer: WidgetPreviewRenderer<ProductListWidget> = ({ widget }) => {
  const fetchedProducts = widget.fetchedData as Product[] | undefined;

  const { data: productsRes, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['products', 'bulk', widget.data.productIds],
    queryFn: async () => {
      if (!widget.data.productIds || widget.data.productIds.length === 0) return { data: [] };
      const params = new URLSearchParams();
      params.append('ids', widget.data.productIds.join(','));
      // Include minimal fields if possible to save bandwidth, but for now full product is fine
      params.append('limit', '50');
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('فشل جلب المنتجات');
      const json = await res.json();
      return json.data; // Return the PaginatedProductsResult object which contains { data: Product[] }
    },
    enabled: !fetchedProducts && !!widget.data.productIds && widget.data.productIds.length > 0,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    initialData: fetchedProducts ? { data: fetchedProducts } : undefined,
  });

  const layout = widget.data.layout === 'slider' ? 'slider' : 'grid';

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 w-1/4 mx-auto rounded"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-gray-200 rounded-3xl"></div>)}
      </div>
    </div>;
  }

  const products = productsRes?.data || [];

  // Sort products to match the order of IDs in the widget config if desired, 
  // or just use the API return order. For now, let's keep API order or map over IDs to preserve order?
  // Mapping over IDs ensures order and handles missing products gracefully.
  const productsArray = Array.isArray(products) ? products : [];
  if (!Array.isArray(products)) {
    console.error('Expected products to be an array, got:', products);
  }

  const orderedProducts = (widget.data.productIds || [])
    .map(id => productsArray.find(p => p.id === id))
    .filter((p): p is Product => !!p);


  return (
    <div>
      {widget.data.title && <h3 className="font-bold text-2xl mb-4 text-center">{widget.data.title}</h3>}
      {layout === 'slider' ? <ProductsSlider products={orderedProducts} /> : <ProductsGrid products={orderedProducts} />}
    </div>
  );
};

export const productListDefinition = {
  type: WidgetType.PRODUCT_LIST,
  Fields: ProductListFields,
  Preview: ProductListPreviewRenderer,
};
