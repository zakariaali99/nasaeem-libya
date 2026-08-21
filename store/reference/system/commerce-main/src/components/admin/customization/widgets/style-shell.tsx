"use client";

import React from 'react';
import { WidgetStyle } from '@/modules/customization/types/customizationTypes';

type PaddingSize = NonNullable<WidgetStyle['paddingY']>;
type LegacyPaddingSize = NonNullable<WidgetStyle['padding']>;
type SidePaddingSize = NonNullable<WidgetStyle['paddingLeft']>;

const paddingYMap: Record<PaddingSize | LegacyPaddingSize, string> = {
  none: '',
  sm: 'py-4',
  md: 'py-6',
  lg: 'py-10',
};

const paddingXMap: Record<PaddingSize | LegacyPaddingSize, string> = {
  none: '',
  sm: 'px-4',
  md: 'px-6',
  lg: 'px-8',
};

const paddingLeftMap: Record<SidePaddingSize | LegacyPaddingSize, string> = {
  none: '',
  sm: 'pl-4',
  md: 'pl-6',
  lg: 'pl-8',
  xl: 'pl-12',
};

const paddingRightMap: Record<SidePaddingSize | LegacyPaddingSize, string> = {
  none: '',
  sm: 'pr-4',
  md: 'pr-6',
  lg: 'pr-8',
  xl: 'pr-12',
};

const marginTopMap: Record<NonNullable<WidgetStyle['marginTop']>, string> = {
  none: '',
  sm: 'mt-2',
  md: 'mt-4',
  lg: 'mt-8',
  xl: 'mt-16',
};

const marginBottomMap: Record<NonNullable<WidgetStyle['marginBottom']>, string> = {
  none: '',
  sm: 'mb-2',
  md: 'mb-4',
  lg: 'mb-8',
  xl: 'mb-16',
};

const marginXMap: Record<NonNullable<WidgetStyle['marginX']>, string> = {
  none: '',
  sm: 'mx-2',
  md: 'mx-4',
  lg: 'mx-6',
  xl: 'mx-10',
};

const radiusMap: Record<NonNullable<WidgetStyle['borderRadius']>, string> = {
  none: 'rounded-none',
  lg: 'rounded-3xl',
  full: 'rounded-[48px]',
};

const objectFitMap: Record<NonNullable<WidgetStyle['objectFit']>, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
  none: 'object-none',
};

export function getRadiusClass(style?: WidgetStyle) {
  const key = style?.borderRadius ?? 'none';
  return radiusMap[key] || radiusMap.none;
}

export function getObjectFitClass(style?: WidgetStyle) {
  const key = style?.objectFit ?? 'cover';
  return objectFitMap[key] || objectFitMap.cover;
}

export function getAspectRatioStyle(style?: WidgetStyle, defaultRatio?: string): React.CSSProperties {
  const ratio = style?.aspectRatio ?? 'none';
  if (ratio === 'none') {
    return defaultRatio ? { aspectRatio: defaultRatio } : {};
  }
  return { aspectRatio: ratio };
}

const shadowMap: Record<NonNullable<WidgetStyle['shadow']>, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  inner: 'shadow-inner',
};

const animationMap: Record<NonNullable<WidgetStyle['animation']>, string> = {
  none: '',
  'fade-in': 'animate-in fade-in duration-700',
  'slide-up': 'animate-in slide-in-from-bottom-4 fade-in duration-700',
  'zoom-in': 'animate-in zoom-in-95 fade-in duration-700',
};

export function WidgetShell({ style, children }: { style?: WidgetStyle; children: React.ReactNode }) {
  const paddingYKey = style?.paddingY ?? style?.padding ?? 'none';
  const paddingXKey = style?.paddingX ?? style?.padding ?? 'none';

  // New Spacing Logic
  const paddingLeftKey = style?.paddingLeft ?? 'none';
  const paddingRightKey = style?.paddingRight ?? 'none';

  const paddingYClass = paddingYMap[paddingYKey] || '';

  // If left/right set, use them. Otherwise fall back to paddingX (legacy or sync)
  // Logic: if paddingLeft is 'none' AND paddingRight is 'none', use paddingX.
  // Actually, 'none' is a valid value for left/right. 
  // If new controls are used, they will be set.
  // If we want to support both:
  // We can just apply all? But they conflict. px-4 adds pl-4 pr-4.
  // Ideally, if paddingLeft/Right are present in style (even if 'none'), we should prioritize them?
  // But legacy widgets won't have them.
  // New widgets will have them default to 'none'.

  // Let's assume if paddingLeft OR paddingRight is NOT none (i.e. user set it), we use individual classes.
  // But wait, user might set "none" explicitly.
  // Let's check if they exist in the style object.
  // But standard usage: style is partial.

  // Better approach:
  // render both? standard CSS cascade? 
  // Tailwind: last class wins? usually.
  // px-4 vs pl-8. 
  // If I put `px-4 pl-8`, pl-8 should overwrite padding-left of px-4.
  // So I can just add all of them, and ensure order.

  const paddingXClass = paddingXMap[paddingXKey] || '';
  const paddingLeftClass = paddingLeftMap[paddingLeftKey as keyof typeof paddingLeftMap] || '';
  const paddingRightClass = paddingRightMap[paddingRightKey as keyof typeof paddingRightMap] || '';

  const marginTopClass = marginTopMap[style?.marginTop ?? 'none'];
  const marginBottomClass = marginBottomMap[style?.marginBottom ?? 'none'];
  const marginXClass = marginXMap[style?.marginX ?? 'none'];
  const radiusClass = getRadiusClass(style);
  const widthClass = style?.width === 'container' ? 'max-w-6xl mx-auto w-full' : 'w-full';
  const fullWidthClass = style?.fullWidth === false ? 'px-4 sm:px-6 lg:px-8' : '';
  const shadowClass = shadowMap[style?.shadow ?? 'none'] || '';
  const animationClass = animationMap[style?.animation ?? 'none'] || '';

  const backgroundStyle: React.CSSProperties = {
    backgroundColor: style?.backgroundColor || undefined,
    color: style?.textColor || undefined,
    backgroundImage: style?.backgroundImageUrl ? `url(${style.backgroundImageUrl})` : undefined,
    backgroundSize: style?.backgroundImageUrl ? 'cover' : undefined,
    backgroundPosition: style?.backgroundImageUrl ? 'center' : undefined,
    height: style?.height || undefined,
    maxWidth: style?.customWidth || undefined,
    marginInline: style?.customWidth ? 'auto' : undefined,
  };

  return (
    <div
      className={`w-full overflow-hidden ${paddingYClass} ${paddingXClass} ${paddingLeftClass} ${paddingRightClass} ${marginTopClass} ${marginBottomClass} ${marginXClass} ${radiusClass} ${fullWidthClass} ${shadowClass} ${animationClass}`}
      style={backgroundStyle}
    >
      <div className={widthClass}>
        {children}
      </div>
    </div>
  );
}
