"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import Image from 'next/image';
import { CarouselEditor } from '@/components/ui/CarouselEditor';
import { HeroCarousel } from '@/components/ui/HeroCarousel';
import { NormalCarousel } from '@/components/ui/NormalCarousel';
import { CarouselWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';
import { getRadiusClass, getObjectFitClass } from './style-shell';

export const CarouselFields: React.FC<WidgetFieldProps> = ({ control, namePrefix }) => (
  <div className="space-y-3">
    <Controller
      name={`${namePrefix}.carouselStyle`}
      control={control}
      render={({ field }) => (
        <div className="space-y-4 border p-3 rounded-md bg-gray-50/50">
          <div className="space-y-1">
            <label className="block text-sm font-medium">نمط العرض</label>
            <select {...field} className="w-full border rounded p-2 bg-white">
              <option value="hero">بطولي (ممتد)</option>
              <option value="normal">سلايدر عادي</option>
            </select>
          </div>

          {field.value === 'normal' && (
            <div className="flex flex-col gap-3 pt-2">
              <Controller
                name={`${namePrefix}.showArrows`}
                control={control}
                render={({ field: arrowField }) => (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={arrowField.value ?? false}
                      onChange={arrowField.onChange}
                      className="rounded border-gray-300"
                    />
                    إظهار أسهم التنقل
                  </label>
                )}
              />
              <Controller
                name={`${namePrefix}.autoPlay`}
                control={control}
                render={({ field: autoPlayField }) => (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPlayField.value ?? true}
                      onChange={autoPlayField.onChange}
                      className="rounded border-gray-300"
                    />
                    تشغيل تلقائي
                  </label>
                )}
              />
            </div>
          )}
        </div>
      )}
    />
    <Controller
      name={`${namePrefix}.slides`}
      control={control}
      render={({ field }) => (
        <CarouselEditor slides={field.value} onChange={field.onChange} />
      )}
    />
  </div>
);

// Helper to ensure full quality image
const getFullImageUrl = (url: string) => {
  if (!url) return '';
  return url.replace(/\/(medium|thumbnail|large)\//, '/full/');
};

export const CarouselPreviewRenderer: WidgetPreviewRenderer<CarouselWidget> = ({ widget, priority }) => {
  const style = widget.data.carouselStyle === 'normal' ? 'normal' : 'hero';
  const CarouselComponent = style === 'normal' ? NormalCarousel : HeroCarousel;
  const objectFit = widget.style?.objectFit ?? 'cover';
  const objectFitClass = getObjectFitClass(widget.style);

  return (
    <CarouselComponent
      className={getRadiusClass(widget.style)}
      height={widget.style?.height}
      showArrows={widget.data.showArrows}
      autoPlay={widget.data.autoPlay}
    >
      {widget.data.slides.map((slide, idx) => (
        (() => {
          // When objectFit is 'none', show original image without constraints
          const image = slide.imageUrl ? (
            objectFit === 'none' ? (
              <div className="flex h-full w-full items-center justify-center bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getFullImageUrl(slide.imageUrl)}
                  alt={slide.title || 'شريحة'}
                  className="max-h-full max-w-full"
                  style={{ objectFit: 'scale-down' }}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="relative h-full w-full">
                <Image
                  src={getFullImageUrl(slide.imageUrl)}
                  alt={slide.title || 'شريحة'}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px"
                  className={objectFitClass}
                  priority={priority && idx === 0}
                />
              </div>
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
              لا توجد صورة
            </div>
          );

          return slide.linkUrl ? (
            <a
              key={idx}
              href={slide.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-full w-full block"
            >
              {image}
            </a>
          ) : (
            <div key={idx} className="h-full w-full">
              {image}
            </div>
          );
        })()
      ))}
    </CarouselComponent>
  );
};

export const carouselDefinition = {
  type: WidgetType.CAROUSEL,
  Fields: CarouselFields,
  Preview: CarouselPreviewRenderer,
};
