"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';
import { HeroCtaWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { SingleImageUpload } from './style-controls';

export const HeroCtaFields: React.FC<WidgetFieldProps> = ({ control, namePrefix }) => (
  <div className="space-y-3">
    <Controller
      name={`${namePrefix}.title`}
      control={control}
      render={({ field }) => (
        <Input {...field} placeholder="عنوان رئيسي جذاب" />
      )}
    />
    <Controller
      name={`${namePrefix}.subtitle`}
      control={control}
      render={({ field }) => (
        <Textarea {...field} placeholder="وصف مختصر يشجع المستخدم" rows={3} />
      )}
    />
    <Controller
      name={`${namePrefix}.buttonLabel`}
      control={control}
      render={({ field }) => (
        <Input {...field} placeholder="نص الزر" />
      )}
    />
    <Controller
      name={`${namePrefix}.buttonUrl`}
      control={control}
      render={({ field }) => (
        <Input {...field} placeholder="رابط الزر" />
      )}
    />
    <Controller
      name={`${namePrefix}.backgroundImageUrl`}
      control={control}
      render={({ field }) => (
        <div className="space-y-1">
          <span className="text-sm font-medium">صورة الخلفية (اختياري)</span>
          <SingleImageUpload value={field.value ?? ''} onChange={field.onChange} />
        </div>
      )}
    />
    <Controller
      name={`${namePrefix}.alignment`}
      control={control}
      render={({ field }) => (
        <div className="space-y-1">
          <label className="text-sm font-medium">محاذاة المحتوى</label>
          <select {...field} className="w-full border rounded px-2 py-2">
            <option value="start">يمين</option>
            <option value="center">وسط</option>
            <option value="end">يسار</option>
          </select>
        </div>
      )}
    />
  </div>
);

export const HeroCtaPreviewRenderer: WidgetPreviewRenderer<HeroCtaWidget> = ({ widget }) => {
  const { title, subtitle, buttonLabel, buttonUrl, backgroundImageUrl, alignment } = widget.data;
  const alignClass = alignment === 'end' ? 'items-end text-left sm:text-left' : alignment === 'start' ? 'items-start text-right sm:text-right' : 'items-center text-center';
  const overlayStyle: React.CSSProperties = backgroundImageUrl ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};

  return (
    <div className={`w-full ${alignClass}`} style={overlayStyle}>
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight text-white drop-shadow">{title}</h2>
      {subtitle && <p className="text-lg sm:text-xl text-white/90 leading-relaxed drop-shadow">{subtitle}</p>}
      <div className={alignment === 'center' ? 'flex justify-center' : alignment === 'end' ? 'flex justify-start' : 'flex justify-end'}>
        {buttonLabel && (
          <Button asChild size="lg" className="rounded-full px-6">
            {buttonUrl ? <a href={buttonUrl}>{buttonLabel}</a> : <span>{buttonLabel}</span>}
          </Button>
        )}
      </div>
    </div>
  );
};

export const heroCtaDefinition = {
  type: WidgetType.HERO_CTA,
  Fields: HeroCtaFields,
  Preview: HeroCtaPreviewRenderer,
};
