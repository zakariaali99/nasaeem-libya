import { z } from 'zod';

export interface InventoryVariant {
    id: string;
    productId: string;
    title: string | null;
    imageUrl?: string | null;
    sku: string | null;
    barcode: string | null;
    price: number;
    inventoryQuantity: number;
    reservedStock: number;
    isActive: boolean;
}

export interface InventoryProduct {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    sku: string | null;
    barcode: string | null;
    price: number;
    stock: number;
    reservedStock: number;
    hasVariants: boolean;
    isActive: boolean;
    variants: InventoryVariant[];
}

export interface InventoryPaginationParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface PaginatedInventoryResult {
    data: InventoryProduct[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const adjustInventorySchema = z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantityChange: z.number(), // + or - amount
    type: z.enum(['purchase', 'sale', 'adjustment', 'return']),
    notes: z.string().optional(),
    reference: z.string().optional(),
});

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
