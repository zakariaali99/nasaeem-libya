"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { PhotoLinkGridEditor, PhotoLinkItem } from '@/components/ui/PhotoLinkGridEditor';
import { PhotoLinkGridWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';
import { getObjectFitClass, getAspectRatioStyle, getRadiusClass } from './style-shell';

export const PhotoLinkGridFields: React.FC<WidgetFieldProps> = ({ control, namePrefix }) => (
  <div className="space-y-4">
    <Controller
      name={`${namePrefix}.title`}
      control={control}
      render={({ field }) => (
        <Input {...field} placeholder="عنوان اختياري" />
      )}
    />
    <Controller
      name={`${namePrefix}.items`}
      control={control}
      render={({ field }) => (
        <PhotoLinkGridEditor
          items={Array.isArray(field.value) ? field.value : []}
          onChange={field.onChange}
        />
      )}
    />
  </div>
);

export const PhotoLinkGridPreviewRenderer: WidgetPreviewRenderer<PhotoLinkGridWidget> = ({ widget }) => {
  const objectFitClass = getObjectFitClass(widget.style);
  const radiusClass = getRadiusClass(widget.style);
  // Default to 4/3 for backward compatibility
  const aspectStyle = getAspectRatioStyle(widget.style, '4 / 3');

  return (
    <div>
      {widget.data.title && (
        <h3 className="font-bold text-2xl mb-4 text-center">{widget.data.title}</h3>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" dir="rtl">
        {(widget.data.items || []).map((item, idx) => {
          const content = (
            <div className="flex flex-col items-center text-center">
              <div className="relative w-full overflow-hidden bg-gray-100" style={aspectStyle}>
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className={`${objectFitClass} ${radiusClass}`}
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-gray-400 ${radiusClass}`}>بدون صورة</div>
                )}
              </div>
              <span className="mt-2 text-sm font-medium truncate max-w-full">{item.name}</span>
            </div>
          );
          return item.linkUrl ? (
            <a key={idx} href={item.linkUrl} className="block">
              {content}
            </a>
          ) : (
            <div key={idx}>{content}</div>
          );
        })}
      </div>
    </div>
  );
};

export const photoLinkGridDefinition = {
  type: WidgetType.PHOTO_LINK_GRID,
  Fields: PhotoLinkGridFields,
  Preview: PhotoLinkGridPreviewRenderer,
};
