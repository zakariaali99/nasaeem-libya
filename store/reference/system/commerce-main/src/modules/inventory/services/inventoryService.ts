import { db } from "@/lib/db/drizzle";
import { products, productVariants, productImages, inventoryTransactions } from "@/lib/db/schema";
import { count, eq, ilike, or, and, desc, inArray, asc, isNull, sql } from "drizzle-orm";
import { InventoryProduct, InventoryVariant, InventoryPaginationParams, PaginatedInventoryResult, AdjustInventoryInput } from "../types/inventoryTypes";

export async function listInventoryProducts(params: InventoryPaginationParams = {}): Promise<PaginatedInventoryResult> {
    const { page = 1, limit = 10, search } = params;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (search) {
        conditions.push(
            or(
                ilike(products.name, `%${search}%`),
                ilike(products.sku, `%${search}%`),
            )
        );
    }

    const whereCondition = conditions.length ? and(...conditions) : undefined;

    const [dbData, totalRes] = await Promise.all([
        db.select()
            .from(products)
            .where(whereCondition)
            .limit(limit)
            .offset(offset)
            .orderBy(desc(products.createdAt)),
        db.select({ count: count() }).from(products).where(whereCondition)
    ]);

    const total = totalRes[0]?.count ?? 0;
    const productIds = dbData.map(p => p.id);

    let imagesMap: Record<string, string> = {};
    let variantsMap: Record<string, InventoryVariant[]> = {};

    if (productIds.length > 0) {
        // Fetch images (first image for products and variants)
        const allImages = await db.select()
            .from(productImages)
            .where(inArray(productImages.productId, productIds))
            .orderBy(asc(productImages.sortOrder));

        allImages.forEach(img => {
            const key = img.variantId ? `variant_${img.variantId}` : `product_${img.productId}`;
            // only keep the first one as they are ordered
            if (!imagesMap[key]) {
                imagesMap[key] = img.url;
            }
        });

        // Fetch variants for these products
        const allVariants = await db.select()
            .from(productVariants)
            .where(inArray(productVariants.productId, productIds))
            .orderBy(asc(productVariants.createdAt));

        allVariants.forEach(v => {
            if (!variantsMap[v.productId]) variantsMap[v.productId] = [];
            variantsMap[v.productId].push({
                id: v.id,
                productId: v.productId,
                title: v.title,
                sku: v.sku,
                barcode: v.barcode,
                price: typeof v.price === 'string' ? parseFloat(v.price) : Number(v.price || 0),
                inventoryQuantity: v.inventoryQuantity ?? 0,
                reservedStock: v.reservedStock ?? 0,
                isActive: v.isActive ?? true,
                imageUrl: imagesMap[`variant_${v.id}`] || null,
            });
        });
    }

    const inventoryProducts: InventoryProduct[] = dbData.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        barcode: p.barcode,
        price: typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price || 0),
        stock: p.stock ?? 0,
        reservedStock: p.reservedStock ?? 0,
        hasVariants: p.hasVariants ?? false,
        isActive: p.isActive ?? true,
        imageUrl: imagesMap[`product_${p.id}`] || null,
        variants: variantsMap[p.id] || [],
    }));

    return {
        data: inventoryProducts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function adjustInventory(input: AdjustInventoryInput, userId: string): Promise<void> {
    const { productId, variantId, quantityChange, type, notes, reference } = input;

    await db.transaction(async (tx) => {
        // Record transaction
        await tx.insert(inventoryTransactions).values({
            productId: productId,
            variantId: variantId ?? null,
            quantity: quantityChange, // amount changed (e.g. 5 or -2)
            type: type, // 'purchase' (adds), 'sale' (removes), 'adjustment' (adds or removes)
            reference: reference,
            notes: notes,
            createdBy: userId,
        });

        if (variantId) {
            // Update variant quantity
            await tx.update(productVariants)
                .set({
                    inventoryQuantity: sql`${productVariants.inventoryQuantity} + ${quantityChange}`
                })
                .where(eq(productVariants.id, variantId));
        } else {
            // Update product stock directly
            await tx.update(products)
                .set({
                    stock: sql`${products.stock} + ${quantityChange}`
                })
                .where(eq(products.id, productId));
        }
    });
}
