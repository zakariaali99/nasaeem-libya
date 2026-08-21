"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import Image from 'next/image';
import Link from 'next/link';
import { ImageEditor } from '@/components/ui/ImageEditor';
import { ImageWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';
import { getRadiusClass, getObjectFitClass, getAspectRatioStyle } from './style-shell';

export const ImageFields: React.FC<WidgetFieldProps> = ({ control, namePrefix }) => (
  <Controller
    name={namePrefix}
    control={control}
    render={({ field }) => {
      const { imageUrl, altText, linkUrl } = field.value || {};
      return (
        <ImageEditor
          imageUrl={imageUrl || ''}
          altText={altText}
          linkUrl={linkUrl}
          onChange={field.onChange}
        />
      );
    }}
  />
);


// Helper to ensure full quality image
const getFullImageUrl = (url: string) => {
  if (!url) return '';
  return url.replace(/\/(medium|thumbnail|large)\//, '/full/');
};

export const ImagePreviewRenderer: WidgetPreviewRenderer<ImageWidget> = ({ widget, priority }) => {
  const hasImage = !!widget.data.imageUrl;
  const objectFitClass = getObjectFitClass(widget.style);
  const radiusClass = getRadiusClass(widget.style);
  // Default to 16/9 for backward compatibility
  const aspectStyle = getAspectRatioStyle(widget.style, '16 / 9');

  const content = hasImage ? (
    <Image
      src={getFullImageUrl(widget.data.imageUrl!)}
      alt={widget.data.altText || ''}
      fill
      sizes="100vw"
      className={`${objectFitClass} ${radiusClass}`}
      priority={priority}
    />
  ) : (
    <div className={`flex h-full w-full items-center justify-center bg-gray-100 text-gray-500 ${radiusClass}`}>
      لا توجد صورة
    </div>
  );

  return (
    <div className="relative w-full overflow-hidden" style={aspectStyle}>
      {widget.data.linkUrl ? (
        <Link href={widget.data.linkUrl} className="block h-full w-full" aria-label={widget.data.altText || 'صورة'}>
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
};

export const imageDefinition = {
  type: WidgetType.IMAGE,
  Fields: ImageFields,
  Preview: ImagePreviewRenderer,
};
