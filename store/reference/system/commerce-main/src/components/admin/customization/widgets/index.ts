import React from 'react';
import { WidgetType } from '@/modules/customization/types/customizationTypes';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';
import { textBlockDefinition } from './text-block';
import { carouselDefinition } from './carousel';
import { imageDefinition } from './image';
import { productListDefinition } from './product-list';
import { categoryListDefinition } from './category-list';
import { collectionShowcaseDefinition } from './collection-showcase';
import { photoLinkGridDefinition } from './photo-link-grid';
import { heroCtaDefinition } from './hero-cta';
import { announcementBarDefinition } from './announcement-bar';
import { spacerDefinition } from './spacer';
import { recentlyViewedDefinition, buyAgainDefinition, recommendedForYouDefinition, trendingNearYouDefinition } from './personalized-widgets';

export type WidgetFieldComponent = React.FC<WidgetFieldProps>;

export const widgetFieldRenderers: Record<WidgetType, WidgetFieldComponent> = {
  [WidgetType.TEXT_BLOCK]: textBlockDefinition.Fields,
  [WidgetType.CAROUSEL]: carouselDefinition.Fields,
  [WidgetType.IMAGE]: imageDefinition.Fields,
  [WidgetType.PRODUCT_LIST]: productListDefinition.Fields,
  [WidgetType.CATEGORY_LIST]: categoryListDefinition.Fields,
  [WidgetType.COLLECTION_SHOWCASE]: collectionShowcaseDefinition.Fields,
  [WidgetType.PHOTO_LINK_GRID]: photoLinkGridDefinition.Fields,
  [WidgetType.HERO_CTA]: heroCtaDefinition.Fields,
  [WidgetType.ANNOUNCEMENT_BAR]: announcementBarDefinition.Fields,
  [WidgetType.SPACER]: spacerDefinition.Fields,
  [WidgetType.RECENTLY_VIEWED]: recentlyViewedDefinition.Fields,
  [WidgetType.BUY_AGAIN]: buyAgainDefinition.Fields,
  [WidgetType.RECOMMENDED_FOR_YOU]: recommendedForYouDefinition.Fields,
  [WidgetType.TRENDING_NEAR_YOU]: trendingNearYouDefinition.Fields,
};

export const widgetPreviewRenderers: Record<WidgetType, WidgetPreviewRenderer<any>> = {
  [WidgetType.TEXT_BLOCK]: textBlockDefinition.Preview,
  [WidgetType.CAROUSEL]: carouselDefinition.Preview,
  [WidgetType.IMAGE]: imageDefinition.Preview,
  [WidgetType.PRODUCT_LIST]: productListDefinition.Preview,
  [WidgetType.CATEGORY_LIST]: categoryListDefinition.Preview,
  [WidgetType.COLLECTION_SHOWCASE]: collectionShowcaseDefinition.Preview,
  [WidgetType.PHOTO_LINK_GRID]: photoLinkGridDefinition.Preview,
  [WidgetType.HERO_CTA]: heroCtaDefinition.Preview,
  [WidgetType.ANNOUNCEMENT_BAR]: announcementBarDefinition.Preview,
  [WidgetType.SPACER]: spacerDefinition.Preview,
  [WidgetType.RECENTLY_VIEWED]: recentlyViewedDefinition.Preview,
  [WidgetType.BUY_AGAIN]: buyAgainDefinition.Preview,
  [WidgetType.RECOMMENDED_FOR_YOU]: recommendedForYouDefinition.Preview,
  [WidgetType.TRENDING_NEAR_YOU]: trendingNearYouDefinition.Preview,
};
