import { z } from 'zod';
import { collections, productToCollection } from '@/lib/db/schema'; // Keep for reference if needed for field names

// Schema for inserting a new collection
export const insertCollectionSchema = z.object({
  name: z.string().min(1, { message: "يجب إدخال اسم المجموعة" }).max(100),
  slug: z.string().min(1, { message: "يجب إدخال الاسم اللطيف للمجموعة" }).max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "يجب أن يحتوي الاسم اللطيف على أحرف صغيرة وأرقام وشرطات فقط" }),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true).optional(),
  // id, createdAt, updatedAt will be handled by the database or ORM
});
export type InsertCollection = z.infer<typeof insertCollectionSchema>;

// Schema for selecting a collection (adjust based on what you expect to select)
export const selectCollectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(), // or z.string() if you handle date strings
  updatedAt: z.date(), // or z.string()
});
export type SelectCollection = z.infer<typeof selectCollectionSchema>;

// Schema for updating a collection
export const updateCollectionSchema = z.object({
  id: z.string().uuid({ message: "معرف المجموعة غير صحيح" }),
  name: z.string().min(1, { message: "يجب إدخال اسم المجموعة" }).max(100).optional(),
  slug: z.string().min(1, { message: "يجب إدخال الاسم اللطيف للمجموعة" }).max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "يجب أن يحتوي الاسم اللطيف على أحرف صغيرة وأرقام وشرطات فقط" }).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateCollection = z.infer<typeof updateCollectionSchema>;

// Schema for inserting into productToCollection
export const insertProductToCollectionSchema = z.object({
  productId: z.string().uuid({ message: "معرف المنتج غير صحيح" }),
  collectionId: z.string().uuid({ message: "معرف المجموعة غير صحيح" }),
});
export type InsertProductToCollection = z.infer<typeof insertProductToCollectionSchema>;

// Schema for selecting from productToCollection
export const selectProductToCollectionSchema = z.object({
  productId: z.string().uuid(),
  collectionId: z.string().uuid(),
  // Add other fields if your join table has more, e.g., addedAt
});
export type SelectProductToCollection = z.infer<typeof selectProductToCollectionSchema>;

// Schema for adding/removing products from a collection (remains the same)
export const manageProductsInCollectionSchema = z.object({
  collectionId: z.string().uuid({ message: "معرف المجموعة غير صحيح" }),
  productIds: z.array(z.string().uuid({ message: "معرف المنتج غير صحيح" })).min(1, { message: "يجب تحديد منتج واحد على الأقل" }),
});
export type ManageProductsInCollection = z.infer<typeof manageProductsInCollectionSchema>;

export const removeProductsFromCollectionSchema = z.object({
  collectionId: z.string().uuid({ message: "معرف المجموعة غير صحيح" }),
  productIds: z.array(z.string().uuid({ message: "معرف المنتج غير صحيح" })).min(1, { message: "يجب تحديد منتج واحد على الأقل" }),
});
export type RemoveProductsFromCollection = z.infer<typeof removeProductsFromCollectionSchema>;

// For API responses, we might want to include products in a collection
export type CollectionWithProducts = SelectCollection & {
  products: { productId: string; name?: string }[];
};
