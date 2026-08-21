import { z } from 'zod';

// Base category type
export interface Category {
  id: string;
  name: string;
  slug: string; // Added slug
  description: string | null;
  parentId: string | null; // For subcategories
  createdAt: Date;
  updatedAt: Date;
  products?: Product[]; // Added to hold associated products
}

// Basic Product type (adjust fields as needed for display in category view)
export interface Product {
  id: string;
  name: string;
  slug: string;
  price: string | number | null; // Assuming price can be string or number, and nullable
  // Add other relevant product fields that you might want to display
  // e.g., imageUrl?: string;
}

// Type for pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

// Type for paginated categories response
export interface PaginatedCategoriesResult {
  data: Category[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Schema for creating a category
export const createCategorySchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  slug: z.string().min(1, "المعرف مطلوب").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "المعرف يجب أن يحتوي على أحرف صغيرة وأرقام وشرطات فقط وبدون مسافات في البداية أو النهاية أو شرطات متتالية").optional(), // Slug is optional, can be auto-generated
  description: z.string().optional().nullable(),
  parentId: z.string().uuid("معرف الفئة الأصلية غير صالح").optional().nullable(),
});

// Schema for updating a category
export const updateCategorySchema = createCategorySchema.partial().extend({
    name: z.string().min(1, "الاسم مطلوب").optional(), // Ensure name is optional during update but still validated if provided
    slug: z.string().min(1, "المعرف مطلوب").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "المعرف يجب أن يحتوي على أحرف صغيرة وأرقام وشرطات فقط وبدون مسافات في البداية أو النهاية أو شرطات متتالية").optional(),
});

// Types for validated input data
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;