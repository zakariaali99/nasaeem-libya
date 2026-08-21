import { z } from "zod";

// Cart item schema supports variant items or product items
export const CartItemSchema = z.union([
  z.object({ variantId: z.string().uuid(), productId: z.string().uuid(), quantity: z.number().int().min(1) }),
  z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) }),
]);

export const CartSchema = z.array(CartItemSchema);

// Schema for adding to cart: either variantId or productId
export const AddToCartSchema = z.union([
  z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1) }),
  z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) }),
]);

// Schema for updating quantity by variant or product
export const UpdateCartItemQuantitySchema = z.union([
  z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(0) }),
  z.object({ productId: z.string().uuid(), quantity: z.number().int().min(0) }),
]);

// Schema for removing item by variant or product
export const RemoveFromCartSchema = z.union([
  z.object({ variantId: z.string().uuid() }),
  z.object({ productId: z.string().uuid() }),
]);

export const UpdateCartDetailsSchema = z.object({
  deliveryRegionId: z.string().optional().nullable(),
  deliveryCityId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  useWallet: z.boolean().optional().nullable(),
});

// TypeScript types for cart and actions
export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type AddCartItemType = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemQuantityType = z.infer<typeof UpdateCartItemQuantitySchema>;
export type RemoveCartItemType = z.infer<typeof RemoveFromCartSchema>;
