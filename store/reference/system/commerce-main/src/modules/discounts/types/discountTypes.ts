import { z } from 'zod';

// Discount types
export const DiscountType = {
  FIXED: 'fixed',
  PERCENTAGE: 'percentage',
  BOGO: 'bogo',
  TIERED: 'tiered',
  DELIVERY: 'delivery',
} as const;

export type DiscountType = typeof DiscountType[keyof typeof DiscountType];

// Discount target types
export const DiscountTarget = {
  PRODUCT: 'product',
  VARIANT: 'variant',
  ORDER: 'order',
  DELIVERY: 'delivery',
  REGION: 'region',
  CITY: 'city',
  COLLECTION: 'collection', // Added collection
} as const;

export type DiscountTarget = typeof DiscountTarget[keyof typeof DiscountTarget];

// Discount base schema
export const discountSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().optional(),
  name: z.string().min(1, 'اسم العرض مطلوب').optional(),
  description: z.string().optional().nullable(),
  type: z.nativeEnum(DiscountType),
  target: z.nativeEnum(DiscountTarget).optional(),
  targetId: z.string().optional().nullable(),
  value: z.number().optional().nullable(),
  percentage: z.number().min(0).max(100).optional().nullable(),
  bogo: z.object({
    buy: z.number().min(1),
    get: z.number().min(1),
    free: z.boolean().default(true),
  }).optional().nullable(),
  tiered: z.array(z.object({
    minQty: z.number().min(1),
    discount: z.number().min(0),
  })).optional().nullable(),
  deliveryDiscount: z.number().optional().nullable(),
  regionId: z.string().optional().nullable(),
  cityId: z.string().optional().nullable(),
  customerSegment: z.string().optional().nullable(),
  collectionId: z.string().optional().nullable(), // For single collection
  collectionIds: z.array(z.string()).optional().nullable(), // For multi-select
  isActive: z.boolean().default(true),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  minOrderAmount: z.number().optional().nullable(),
  maxDiscountAmount: z.number().optional().nullable(),
  usageLimit: z.number().optional().nullable(),
  usageCount: z.number().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Discount = z.infer<typeof discountSchema>;
