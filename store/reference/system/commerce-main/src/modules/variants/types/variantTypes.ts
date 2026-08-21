import { z } from 'zod';
import { Product } from '@/modules/products/types/productTypes';
import { ProductImage } from '@/modules/images/types/imageTypes'; // Assuming Image type exists

// Interface for a single selected option/value pair for a variant
export interface VariantOptionValue {
    optionId: string;
    valueId: string;
    optionName: string; // e.g., "Color"
    value: string; // e.g., "Red"
}

export interface ProductVariant {
    id: string;
    productId: string; // Foreign key to Product
    title?: string | null;
    sku?: string | null;
    barcode?: string | null;
    price: number; // Variant specific price
    compareAtPrice?: number | null; // Variant specific compare price
    inventoryQuantity: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    // Array of selected options/values for this variant
    options?: VariantOptionValue[];
    images?: ProductImage[]; // Add images array
}

// Zod schema for creating a product
export const createProductSchema = z.object({
    name: z.string().min(1, "الاسم مطلوب"),
    slug: z.string().min(1, "المعرف مطلوب").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "المعرف يجب أن يحتوي على أحرف صغيرة وأرقام وشرطات فقط"),
    description: z.string().optional(),
    price: z.number().positive("السعر يجب أن يكون رقمًا موجبًا"),
    compareAtPrice: z.number().positive("سعر المقارنة يجب أن يكون رقمًا موجبًا").optional().nullable(),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    categoryId: z.string().uuid("معرف الفئة غير صالح").optional().nullable(),
    hasVariants: z.boolean().default(false),
    metaTitle: z.string().optional().nullable(),
    metaDescription: z.string().optional().nullable(),
});

// Zod schema for updating a product (similar to create, but fields are optional)
export const updateProductSchema = createProductSchema.partial().extend({
    slug: createProductSchema.shape.slug.optional(), // Slug might not always be updatable or required on update
});

// Zod schema for creating a product variant
export const createProductVariantSchema = z.object({
    productId: z.string().uuid("معرف المنتج غير صالح"),
    title: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    price: z.number().positive("السعر يجب أن يكون رقمًا موجبًا"),
    compareAtPrice: z.number().positive("سعر المقارنة يجب أن يكون رقمًا موجبًا").optional().nullable(),
    inventoryQuantity: z.number().int().min(0, "الكمية يجب أن تكون صفرًا أو أكثر").default(0),
    isActive: z.boolean().default(true),
    // Add image field - assuming we store URLs or IDs after upload
    images: z.array(z.object({
        url: z.string(),
        altText: z.string().optional().nullable(),
        sortOrder: z.number().int().optional().default(0), // Add sortOrder
    })).optional().default([]),
    // Validate options as an array of objects with optionId and valueId
    options: z.array(z.object({
        optionId: z.string().min(1, "معرف الخيار مطلوب"),
        valueId: z.string().min(1, "معرف القيمة مطلوب"),
        optionName: z.string().optional(),
        value: z.string().optional()
    })).min(1, "يجب تحديد خيار واحد على الأقل للمتغير").optional(), // Make optional if variants can exist without options initially
});

// Zod schema for updating a product variant
export const updateProductVariantSchema = createProductVariantSchema.partial().omit({ productId: true }).extend({
    title: z.string().optional().nullable(),
    options: createProductVariantSchema.shape.options.optional(),
    images: createProductVariantSchema.shape.images.optional(),
});

// Type for validated create product data
export type CreateProductInput = z.infer<typeof createProductSchema>;

// Type for validated update product data
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Type for validated create product variant data
export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;

// Type for validated update product variant data
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;

// Type for pagination parameters
export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
    productId?: string; // Optional: Filter variants by product ID
}

// Type for paginated product list response
export interface PaginatedProductsResult {
    data: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Type for paginated product variant list response
export interface PaginatedProductVariantsResult {
    data: ProductVariant[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// New type for product variant with images
export interface ProductVariantWithImages extends ProductVariant {
    images: ProductImage[];
    optionValues: VariantOptionValue[];
}
