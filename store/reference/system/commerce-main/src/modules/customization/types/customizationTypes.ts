import { z } from 'zod';

export enum WidgetType {
  CAROUSEL = 'carousel',
  TEXT_BLOCK = 'text_block',
  IMAGE = 'image',
  PRODUCT_LIST = 'product_list',
  COLLECTION_SHOWCASE = 'collection_showcase',
  CATEGORY_LIST = 'category_list',
  PHOTO_LINK_GRID = 'photo_link_grid',
  HERO_CTA = 'hero_cta',
  ANNOUNCEMENT_BAR = 'announcement_bar',
  // PRODUCT_CAROUSEL = 'product_carousel',
  // CATEGORY_CAROUSEL = 'category_carousel',
  // COLLECTION_CAROUSEL = 'collection_carousel',
  SPACER = 'spacer',
  RECENTLY_VIEWED = 'recently_viewed',
  BUY_AGAIN = 'buy_again',
  RECOMMENDED_FOR_YOU = 'recommended_for_you',
  TRENDING_NEAR_YOU = 'trending_near_you',
}

export const announcementIconValues = [
  'megaphone',
  'info',
  'sparkles',
  'bell',
  'gift',
  'star',
  'tag',
] as const;

export type AnnouncementIcon = typeof announcementIconValues[number];

const carouselImageSchema = z.object({
  url: z.string().url({ message: 'رابط الصورة غير صالح' }),
  alt: z.string().optional(),
});

export const widgetDataSchema = z.union([
  z.object({ // CAROUSEL
    slides: z.array(
      z.object({
        imageUrl: z.string().min(1, "رابط الصورة مطلوب"),
        linkUrl: z.string().optional(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
      })
    ),
    carouselStyle: z.enum(['hero', 'normal']).default('hero').optional(),
  }),
  z.object({ // TEXT_BLOCK
    content: z.string().min(1, 'المحتوى مطلوب'),
  }),
  z.object({ // IMAGE
    url: z.string().min(1, "رابط الصورة مطلوب"),
    alt: z.string().optional(),
  }),
  z.object({ // PRODUCT_LIST, PRODUCT_CAROUSEL
    productIds: z.array(z.string()),
  }),
  z.object({ // CATEGORY_LIST, CATEGORY_CAROUSEL
    categoryIds: z.array(z.string()),
  }),
  z.object({ // COLLECTION_SHOWCASE
    collectionId: z.string(),
  }),
  z.object({ // COLLECTION_CAROUSEL
    collectionIds: z.array(z.string()),
  }),
  z.object({ // PHOTO_LINK_GRID (legacy simple schema, not used by forms)
    title: z.string().optional(),
    items: z.array(z.object({
      imageUrl: z.string(),
      name: z.string(),
      linkUrl: z.string().url().optional(),
    })),
  }),
  z.object({ // HERO CTA
    title: z.string(),
    subtitle: z.string().optional(),
    buttonLabel: z.string(),
    buttonUrl: z.string().optional(),
    alignment: z.enum(['start', 'center', 'end']).optional(),
    backgroundImageUrl: z.string().optional(),
  }),
  z.object({ // ANNOUNCEMENT BAR
    title: z.string().optional(),
    message: z.string(),
    linkLabel: z.string().optional(),
    linkUrl: z.string().optional(),
    dismissible: z.boolean().optional(),
    icon: z.enum(announcementIconValues).default('megaphone').optional(),
  }),
  z.object({ // SPACER
    height: z.enum(['sm', 'md', 'lg', 'xl', '2xl']).default('md'),
  }),
]);

export interface WidgetStyle {
  /** @deprecated استخدم paddingY/paddingX. مدعوم للتوافق فقط */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  paddingX?: 'none' | 'sm' | 'md' | 'lg';
  paddingY?: 'none' | 'sm' | 'md' | 'lg';
  marginTop?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  marginBottom?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  marginX?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  backgroundColor?: string;
  backgroundImageUrl?: string;
  textColor?: string;
  borderRadius?: 'none' | 'lg' | 'full';
  width?: 'full' | 'container';
  fullWidth?: boolean;
  height?: string;
  customWidth?: string;
  aspectRatio?: 'none' | '1/1' | '4/3' | '16/9' | '21/9';
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'inner';
  animation?: 'none' | 'fade-in' | 'slide-up' | 'zoom-in';
  paddingLeft?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  paddingRight?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  syncSpacing?: boolean;
}

// ── Targeting types ────────────────────────────────────

export type TargetingRule =
  | { type: 'segment'; operator: 'in' | 'not_in'; value: string[]; }
  | { type: 'auth_status'; operator: 'is'; value: 'guest' | 'authenticated'; }
  | { type: 'time_range'; operator: 'between'; value: { days?: number[]; startHour?: number; endHour?: number; startDate?: string; endDate?: string; }; }
  | { type: 'region'; operator: 'in' | 'not_in'; value: string[]; };

export interface WidgetTargeting {
  enabled: boolean;
  rules: TargetingRule[];
}

export interface UserTargetingContext {
  isGuest: boolean;
  segment: string | null;
  region: string | null; // Resolved city name from IP or user profile
}

export interface StorefrontLayout {
  id: string;
  name: string;
  isGlobalActive: boolean;
  activeStartDate: Date | null;
  activeEndDate: Date | null;
  activeDays: number[] | null;
  activeStartHour: number | null;
  activeEndHour: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Base Widget Interface
export interface BaseWidget {
  id: string;
  layoutId: string;
  type: WidgetType;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  style?: WidgetStyle;
  targeting?: WidgetTargeting;
  fetchedData?: any; // Data fetched on the server (RSC) to avoid client-side roundtrips
}

// Carousel Widget
export interface CarouselWidget extends BaseWidget {
  type: WidgetType.CAROUSEL;
  data: {
    slides: {
      imageUrl: string;
      linkUrl?: string;
      title?: string;
      subtitle?: string;
    }[];
    carouselStyle?: 'hero' | 'normal';
    showArrows?: boolean;
    autoPlay?: boolean;
  };
}

// Text Block Widget
export interface TextBlockWidget extends BaseWidget {
  type: WidgetType.TEXT_BLOCK;
  data: {
    content: string;
    textAlign?: 'left' | 'center' | 'right';
  };
}

// Image Widget
export interface ImageWidget extends BaseWidget {
  type: WidgetType.IMAGE;
  data: {
    imageUrl: string;
    linkUrl?: string;
    altText?: string;
  };
}

// Product List Widget
export interface ProductListWidget extends BaseWidget {
  type: WidgetType.PRODUCT_LIST;
  data: {
    title: string;
    productIds: string[];
    layout?: 'grid' | 'slider';
  };
}

// Collection Showcase Widget
export interface CollectionShowcaseWidget extends BaseWidget {
  type: WidgetType.COLLECTION_SHOWCASE;
  data: {
    collectionId: string;
    layout?: 'grid' | 'slider';
  };
}

// Category List Widget
export interface CategoryListWidget extends BaseWidget {
  type: WidgetType.CATEGORY_LIST;
  data: {
    title: string;
    categoryIds: string[];
    layout?: 'grid' | 'slider';
  };
}

export interface PhotoLinkGridWidget extends BaseWidget {
  type: WidgetType.PHOTO_LINK_GRID;
  data: {
    title?: string;
    items: {
      imageUrl: string;
      name: string;
      linkUrl?: string;
    }[];
  };
}

export interface HeroCtaWidget extends BaseWidget {
  type: WidgetType.HERO_CTA;
  data: {
    title: string;
    subtitle?: string;
    buttonLabel: string;
    buttonUrl?: string;
    alignment?: 'start' | 'center' | 'end';
    backgroundImageUrl?: string;
  };
}

export interface AnnouncementBarWidget extends BaseWidget {
  type: WidgetType.ANNOUNCEMENT_BAR;
  data: {
    title?: string;
    message: string;
    linkLabel?: string;
    linkUrl?: string;
    dismissible?: boolean;
    icon?: AnnouncementIcon;
  };
}

export interface SpacerWidget extends BaseWidget {
  type: WidgetType.SPACER;
  data: {
    height: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  };
}

// Recently Viewed Widget (dynamic, per-user)
export interface RecentlyViewedWidget extends BaseWidget {
  type: WidgetType.RECENTLY_VIEWED;
  data: {
    title: string;
    limit: number;
    layout: 'grid' | 'slider';
  };
}

// Buy Again Widget (dynamic, per-user)
export interface BuyAgainWidget extends BaseWidget {
  type: WidgetType.BUY_AGAIN;
  data: {
    title: string;
    limit: number;
    layout: 'grid' | 'slider';
  };
}

// Recommended For You Widget (dynamic, per-user)
export interface RecommendedForYouWidget extends BaseWidget {
  type: WidgetType.RECOMMENDED_FOR_YOU;
  data: {
    title: string;
    limit: number;
    layout: 'grid' | 'slider';
  };
}

// Trending Near You Widget (dynamic, per-region)
export interface TrendingNearYouWidget extends BaseWidget {
  type: WidgetType.TRENDING_NEAR_YOU;
  data: {
    title: string;
    limit: number;
    layout: 'grid' | 'slider';
  };
}

// // Product Carousel Widget
// export interface ProductCarouselWidget extends BaseWidget {
//     type: WidgetType.PRODUCT_CAROUSEL;
//     data: {
//         title: string;
//         productIds: string[];
//     };
// }

// // Category Carousel Widget
// export interface CategoryCarouselWidget extends BaseWidget {
//     type: WidgetType.CATEGORY_CAROUSEL;
//     data: {
//         title: string;
//         categoryIds: string[];
//     };
// }

// // Collection Carousel Widget
// export interface CollectionCarouselWidget extends BaseWidget {
//     type: WidgetType.COLLECTION_CAROUSEL;
//     data: {
//         title: string;
//         collectionIds: string[];
//     };
// }


// Union type for all widgets
export type Widget =
  | CarouselWidget
  | TextBlockWidget
  | ImageWidget
  | ProductListWidget
  | CollectionShowcaseWidget
  | CategoryListWidget
  | PhotoLinkGridWidget
  | HeroCtaWidget
  | AnnouncementBarWidget
  | SpacerWidget
  | RecentlyViewedWidget
  | BuyAgainWidget
  | RecommendedForYouWidget
  | TrendingNearYouWidget;
// | ProductCarouselWidget
// | CategoryCarouselWidget
// | CollectionCarouselWidget;

// Zod Schemas for Validation

const baseWidgetSchema = z.object({
  layoutId: z.string().uuid().optional(),
  type: z.nativeEnum(WidgetType),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const carouselDataSchema = z.object({
  slides: z.array(
    z.object({
      imageUrl: z.string().min(1, "رابط الصورة مطلوب"),
      linkUrl: z.string().optional(), // optional field
      title: z.string().optional(),
      subtitle: z.string().optional(),
    })
  ),
  carouselStyle: z.enum(['hero', 'normal']).default('hero').optional(),
  showArrows: z.boolean().default(false).optional(),
  autoPlay: z.boolean().default(true).optional(),
});

const textBlockDataSchema = z.object({
  content: z.string().min(1, "المحتوى مطلوب"),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
});

const imageDataSchema = z.object({
  imageUrl: z.union([
    z.string().min(1, "رابط الصورة مطلوب"),
    z.literal("")
  ]),
  linkUrl: z.string().optional(), // optional accompanying field
  altText: z.string().optional(),
});

const productListDataSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  productIds: z.array(z.string().uuid("معرف المنتج غير صالح")),
  layout: z.enum(['grid', 'slider']).default('grid').optional(),
});

const collectionShowcaseDataSchema = z.object({
  collectionId: z.string().uuid("معرف المجموعة غير صالح"),
  layout: z.enum(['grid', 'slider']).default('grid').optional(),
});

const categoryListDataSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  categoryIds: z.array(z.string().uuid("معرف الفئة غير صالح")),
  layout: z.enum(['grid', 'slider']).default('grid').optional(),
});

const productCarouselDataSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  productIds: z.array(z.string().uuid("معرف المنتج غير صالح")),
});

const categoryCarouselDataSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  categoryIds: z.array(z.string().uuid("معرف الفئة غير صالح")),
});

const collectionCarouselDataSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  collectionIds: z.array(z.string().uuid("معرف المجموعة غير صالح")),
});

const photoLinkGridDataSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    imageUrl: z.string().trim().min(1, "رابط الصورة مطلوب"),
    name: z.string().min(1, "الاسم مطلوب"),
    linkUrl: z.string().trim().optional().or(z.literal("")),
  })),
});

const relaxedUrl = z.string().trim().optional().refine((val) => {
  if (val === undefined || val === '') return true;
  return /^https?:\/\//.test(val) || val.startsWith('/');
}, { message: 'رابط غير صالح' });

const heroCtaDataSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  subtitle: z.string().optional(),
  buttonLabel: z.string().min(1, "نص الزر مطلوب"),
  buttonUrl: relaxedUrl,
  alignment: z.enum(['start', 'center', 'end']).default('center').optional(),
  backgroundImageUrl: relaxedUrl,
});

const announcementBarDataSchema = z.object({
  title: z.string().optional(),
  message: z.string().min(1, "الرسالة مطلوبة"),
  linkLabel: z.string().optional(),
  linkUrl: z.string().url("رابط غير صالح").optional().or(z.literal("")),
  dismissible: z.boolean().default(false).optional(),
  icon: z.enum(announcementIconValues).default('megaphone').optional(),
});

const cssDimensionSchema = z.string().trim().optional().refine((val) => {
  if (val === undefined || val === '') return true;
  return /^(auto|0|\d+(px|rem|em|%|vh|vw))$/i.test(val);
}, { message: 'استخدم قيمة مثل 300px أو 50vh' });

const styleSchema = z.object({
  padding: z.enum(['none', 'sm', 'md', 'lg']).default('none').optional(),
  paddingX: z.enum(['none', 'sm', 'md', 'lg']).default('none').optional(),
  paddingY: z.enum(['none', 'sm', 'md', 'lg']).default('none').optional(),
  marginTop: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('none').optional(),
  marginBottom: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('none').optional(),
  marginX: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('none').optional(),
  backgroundColor: z.string().trim().optional(),
  backgroundImageUrl: relaxedUrl,
  textColor: z.string().trim().optional(),
  borderRadius: z.enum(['none', 'lg', 'full']).default('none').optional(),
  width: z.enum(['full', 'container']).default('full').optional(),
  fullWidth: z.boolean().default(true).optional(),
  height: cssDimensionSchema,
  customWidth: cssDimensionSchema,
  aspectRatio: z.enum(['none', '1/1', '4/3', '16/9', '21/9']).default('none').optional(),
  objectFit: z.enum(['cover', 'contain', 'fill', 'none']).default('cover').optional(),
  shadow: z.enum(['none', 'sm', 'md', 'lg', 'xl', 'inner']).default('none').optional(),
  animation: z.enum(['none', 'fade-in', 'slide-up', 'zoom-in']).default('none').optional(),
  paddingLeft: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('none').optional(),
  paddingRight: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('none').optional(),
  syncSpacing: z.boolean().default(false).optional(),
});

// Zod schema for targeting rules
const targetingRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('segment'),
    operator: z.enum(['in', 'not_in']),
    value: z.array(z.string().min(1)),
  }),
  z.object({
    type: z.literal('auth_status'),
    operator: z.literal('is'),
    value: z.enum(['guest', 'authenticated']),
  }),
  z.object({
    type: z.literal('time_range'),
    operator: z.literal('between'),
    value: z.object({
      days: z.array(z.number().int().min(0).max(6)).optional(),
      startHour: z.number().int().min(0).max(23).optional(),
      endHour: z.number().int().min(0).max(23).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('region'),
    operator: z.enum(['in', 'not_in']),
    value: z.array(z.string().min(1)),
  }),
]);

const targetingSchema = z.object({
  enabled: z.boolean().default(false),
  rules: z.array(targetingRuleSchema).default([]),
});

// Zod schema for dynamic widget data
const personalizedWidgetDataSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  limit: z.number().int().min(1).max(24).default(8),
  layout: z.enum(['grid', 'slider']).default('grid'),
});

export const createWidgetSchema = baseWidgetSchema.extend({
  data: z.union([
    carouselDataSchema,
    textBlockDataSchema,
    imageDataSchema,
    productListDataSchema,
    collectionShowcaseDataSchema,
    categoryListDataSchema,
    productCarouselDataSchema,
    categoryCarouselDataSchema,
    collectionCarouselDataSchema,
    photoLinkGridDataSchema,
    heroCtaDataSchema,
    announcementBarDataSchema,
    photoLinkGridDataSchema,
    heroCtaDataSchema,
    announcementBarDataSchema,
    z.object({ height: z.enum(['sm', 'md', 'lg', 'xl', '2xl']).default('md') }), // Spacer schema
    personalizedWidgetDataSchema, // Recently Viewed / Buy Again / Recommended
  ]),
  style: styleSchema.optional(),
  targeting: targetingSchema.optional(),
});

export const updateWidgetSchema = createWidgetSchema.partial();

export type CreateWidgetInput = z.infer<typeof createWidgetSchema>;
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;

export interface WidgetDefinition {
  name: string;
  defaultSettings: Record<string, any>;
}

// Type for pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Type for paginated widgets response
export interface PaginatedWidgetsResult {
  data: Widget[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const createLayoutSchema = z.object({
  name: z.string().min(1, "اسم التخطيط مطلوب"),
  isGlobalActive: z.boolean().default(false),
  activeStartDate: z.string().datetime().nullable().optional(),
  activeEndDate: z.string().datetime().nullable().optional(),
  activeDays: z.array(z.number().min(0).max(6)).nullable().optional(),
  activeStartHour: z.number().min(0).max(23).nullable().optional(),
  activeEndHour: z.number().min(0).max(23).nullable().optional(),
});

export const updateLayoutSchema = createLayoutSchema.partial();

export type CreateLayoutInput = z.infer<typeof createLayoutSchema>;
export type UpdateLayoutInput = z.infer<typeof updateLayoutSchema>;
