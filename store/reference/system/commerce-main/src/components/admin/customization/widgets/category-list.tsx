"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import Select from 'react-select';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { CategoryListWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';

export const CategoryListFields: React.FC<WidgetFieldProps> = ({ control, namePrefix, categoryOptions = [], rtlSelectStyles }) => (
  <div className="space-y-2">
    <Controller
      name={`${namePrefix}.title`}
      control={control}
      render={({ field }) => (
        <Input {...field} placeholder="عنوان الفئات" />
      )}
    />
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
          <p className="text-xs text-gray-500">على الجوال سيتم عرض ثلاثة عناصر بالصف إن وجدت.</p>
        </div>
      )}
    />
    <Controller
      name={`${namePrefix}.categoryIds`}
      control={control}
      render={({ field }) => (
        <Select
          isMulti
          options={categoryOptions}
          value={categoryOptions.filter((opt) => Array.isArray(field.value) && field.value.includes(opt.value))}
          onChange={(opts) => field.onChange((opts as any).map((o: any) => o.value))}
          styles={rtlSelectStyles}
          classNamePrefix="react-select"
          placeholder="اختر الفئات"
        />
      )}
    />
  </div>
);

const CategoryInfo: React.FC<{ id: string; initialData?: { name: string; id: string } }> = ({ id, initialData }) => {
  const { data: category, isLoading } = useQuery<{ data: { name: string } }>(
    {
      queryKey: ['category-info', id],
      queryFn: async () => {
        const res = await fetch(`/api/categories/${id}`);
        if (!res.ok) return null;
        return res.json();
      },
      enabled: !initialData && !!id,
      initialData: initialData ? { data: initialData } : undefined,
    }
  );

  if (isLoading) return <div className="border rounded p-2 animate-pulse bg-gray-200 h-10"></div>;
  return <div className="border rounded p-2 text-sm">{category?.data?.name || 'فئة غير معروفة'}</div>;
};

const GridPreview: React.FC<{ widget: CategoryListWidget }> = ({ widget }) => (
  <div>
    <h3 className="font-bold text-2xl mb-4 text-center">{widget.data.title}</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" dir="rtl">
      {widget.data.categoryIds.map((id) => {
        const dataArr = Array.isArray(widget.fetchedData) ? widget.fetchedData : [];
        const preData = dataArr.find((c: any) => c.id === id);
        return (
          <div key={id} className="border rounded p-2">
            <CategoryInfo id={id} initialData={preData} />
          </div>
        );
      })}
    </div>
  </div>
);

const SliderPreview: React.FC<{ widget: CategoryListWidget }> = ({ widget }) => (
  <div>
    <h3 className="font-bold text-2xl mb-4 text-center">{widget.data.title}</h3>
    <div className="flex overflow-x-auto gap-3 pb-2" dir="rtl">
      {widget.data.categoryIds.map((id) => {
        const dataArr = Array.isArray(widget.fetchedData) ? widget.fetchedData : [];
        const preData = dataArr.find((c: any) => c.id === id);
        return (
          <div key={id} className="shrink-0 w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5">
            <div className="border rounded p-2"><CategoryInfo id={id} initialData={preData} /></div>
          </div>
        );
      })}
    </div>
  </div>
);

export const CategoryListPreviewRenderer: WidgetPreviewRenderer<CategoryListWidget> = ({ widget }) => {
  const layout = widget.data.layout === 'slider' ? 'slider' : 'grid';
  return layout === 'slider' ? <SliderPreview widget={widget} /> : <GridPreview widget={widget} />;
};

export const categoryListDefinition = {
  type: WidgetType.CATEGORY_LIST,
  Fields: CategoryListFields,
  Preview: CategoryListPreviewRenderer,
};
