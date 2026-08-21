import { z } from 'zod';
import { ProductImage } from '@/modules/images/types/imageTypes'; // Assuming Image type exists
import { DiscountType } from '@/modules/discounts/types/discountTypes';

// Define discount info for products
export interface ProductDiscount {
  id: string;
  name?: string;
  type: DiscountType;
  value?: number | null;
  percentage?: number | null;
  bogo?: { buy: number; get: number; free: boolean };
  tiered?: { minQty: number; discount: number }[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null; // Allow null from DB
  price: number | string;
  compareAtPrice?: number | null; // Allow null from DB
  sku?: string | null; // Allow null from DB
  barcode?: string | null; // Allow null from DB
  isActive: boolean;
  categoryId?: string | null; // Allow null from DB
  hasVariants: boolean;
  metaTitle?: string | null; // Allow null from DB
  metaDescription?: string | null; // Allow null from DB
  createdAt: Date;
  updatedAt: Date;
  stock?: number; // Optional: Total stock, calculated for admins
  images?: ProductImage[]; // Add images array
  trackQuantity: boolean; // جديد: تتبع الكمية
  width?: number;        // جديد: عرض المنتج (سم)
  length?: number;       // جديد: طول المنتج (سم)
  height?: number;       // جديد: ارتفاع المنتج (سم)
  weight?: number;       // جديد: وزن المنتج (كجم)
  discounts?: ProductDiscount[]; // عروض مرتبطة بالمنتج
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku?: string | null; // Allow null from DB
  barcode?: string | null; // Allow null from DB
  price: number;
  compareAtPrice?: number | null; // Allow null from DB
  inventoryQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Base Zod schema for product data (without refine)
const productBaseSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  slug: z.string().min(1, "المعرف مطلوب").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "المعرف يجب أن يحتوي على أحرف صغيرة وأرقام وشرطات فقط"),
  description: z.string().optional().nullable(),
  price: z.union([
    z.number().positive("السعر يجب أن يكون رقمًا موجبًا"),
    z.number().min(0) // Allow zero for products with variants
  ]).optional(), // Price is optional here
  compareAtPrice: z.number().positive("سعر المقارنة يجب أن يكون رقمًا موجبًا").optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  categoryId: z.string().uuid("معرف الفئة غير صالح").optional().nullable(),
  hasVariants: z.boolean().default(false),
  trackQuantity: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  width: z.number().min(0, "العرض يجب أن يكون رقمًا غير سالب").optional(),
  length: z.number().min(0, "الطول يجب أن يكون رقمًا غير سالب").optional(),
  height: z.number().min(0, "الارتفاع يجب أن يكون رقمًا غير سالب").optional(),
  weight: z.number().min(0, "الوزن يجب أن يكون رقمًا غير سالب").optional(),
  images: z.array(z.object({
    url: z.string(),
    altText: z.string().optional().nullable(),
    sortOrder: z.number().int().optional().default(0),
  })).optional().default([]),
  stock: z.number().int().min(0, "المخزون يجب أن يكون رقمًا غير سالب").optional().default(0), // Allow setting initial stock
});

// Zod schema for creating a product, adding the refinement
export const createProductSchema = productBaseSchema.refine(
  (data) => {
    // If product has variants, price can be 0 or undefined
    if (data.hasVariants) {
      return true;
    }
    // If no variants, price must be positive
    return data.price !== undefined && data.price > 0;
  },
  {
    message: "السعر مطلوب للمنتج بدون متغيرات ويجب أن يكون رقماً موجباً",
    path: ["price"],
  }
).refine(
  (data) => data.trackQuantity === true || data.trackQuantity === false,
  { message: "يجب تحديد ما إذا كان يجب تتبع المخزون", path: ["trackQuantity"] }
);

// Zod schema for updating a product (use partial on the base schema)
export const updateProductSchema = productBaseSchema.partial().extend({
  // Slug might not always be updatable or required on update
  slug: productBaseSchema.shape.slug.optional(),
  // Ensure images can be updated too (already optional in base, partial makes the array itself optional)
  images: productBaseSchema.shape.images.optional(),
  trackQuantity: productBaseSchema.shape.trackQuantity.optional(),
  width: productBaseSchema.shape.width.optional(),
  length: productBaseSchema.shape.length.optional(),
  height: productBaseSchema.shape.height.optional(),
  weight: productBaseSchema.shape.weight.optional(),
  stock: productBaseSchema.shape.stock.optional(),
});

// Type for validated create product data
export type CreateProductInput = z.infer<typeof createProductSchema>;

// Type for validated update product data
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Type for pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'price' | 'name' | 'createdAt'; // حقل الفرز
  order?: 'asc' | 'desc'; // ترتيب الفرز
  minPrice?: number; // سعر أدنى للتصفية
  maxPrice?: number; // سعر أقصى للتصفية
  categoryId?: string; // فلترة حسب الفئة
  collectionId?: string; // فلترة حسب المجموعة
  ids?: string[]; // فلترة حسب قائمة معرفات
}

export interface PaginatedProductsResult {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const bulkUpdateProductSchema = z.array(
  z.object({
    id: z.string().uuid(),
    data: updateProductSchema
  })
);

export type BulkUpdateProductInput = z.infer<typeof bulkUpdateProductSchema>;
