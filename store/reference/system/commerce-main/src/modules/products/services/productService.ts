import { db } from "@/lib/db/drizzle";
import { products, productVariants, productImages, productToCategory, productToCollection, analyticsEvents, analyticsRfmScores, analyticsRfmConfigs, categories, collections } from "@/lib/db/schema";
// Import isNull and isNotNull for Drizzle null checks
import { eq, ilike, or, count, and, sum, inArray, asc, desc, gte, lte, isNull, isNotNull, ne, sql } from "drizzle-orm";
import { Product, PaginationParams, PaginatedProductsResult, CreateProductInput, UpdateProductInput, BulkUpdateProductInput } from "../types/productTypes";
import { ProductImage, ProductImageInput } from "@/modules/images/types/imageTypes"; // Import ProductImageInput
import { createProductSchema, updateProductSchema } from "../types/productTypes";
import { listDiscounts, DiscountWithTargets } from '@/modules/discounts/services/discountService';
import { ProductDiscount } from '../types/productTypes';

// Helper function to convert raw DB product to Product type
function mapDbProductToProduct(dbProduct: any, stock?: number, images?: ProductImage[], priceOverride?: number | string): Product {
    if (!dbProduct) {
        // This case should ideally not happen if called correctly
        throw new Error("mapDbProductToProduct received null or undefined dbProduct");
    }
    return {
        id: dbProduct.id,
        name: dbProduct.name,
        slug: dbProduct.slug,
        description: dbProduct.description,
        price: priceOverride !== undefined
            ? priceOverride
            : (typeof dbProduct.price === 'string' ? parseFloat(dbProduct.price) : (dbProduct.price ?? 0)),
        compareAtPrice: dbProduct.compareAtPrice === null || dbProduct.compareAtPrice === undefined
            ? null
            : (typeof dbProduct.compareAtPrice === 'string' ? parseFloat(dbProduct.compareAtPrice) : dbProduct.compareAtPrice),
        sku: dbProduct.sku,
        barcode: dbProduct.barcode,
        isActive: dbProduct.isActive,
        categoryId: dbProduct.categoryId,
        hasVariants: dbProduct.hasVariants,
        trackQuantity: dbProduct.trackQuantity,
        width: dbProduct.width,
        length: dbProduct.length,
        height: dbProduct.height,
        weight: dbProduct.weight,
        metaTitle: dbProduct.metaTitle,
        metaDescription: dbProduct.metaDescription,
        createdAt: dbProduct.createdAt,
        updatedAt: dbProduct.updatedAt,
        stock: stock, // Include calculated stock if provided
        images: images, // Include images if provided
    };
}

// Normalize any persisted price shape to a number
function parsePrice(value: number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

// Helper function to get images for a list of products
async function getImagesForProducts(productIds: string[]): Promise<Record<string, ProductImage[]>> {
    if (productIds.length === 0) return {};

    const dbImages = await db.select()
        .from(productImages)
        .where(and(
            inArray(productImages.productId, productIds),
            isNull(productImages.variantId) // Use isNull for checking null variantId
        ))
        .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt)); // Order by sortOrder, then creation date

    const imageMap: Record<string, ProductImage[]> = {};
    for (const img of dbImages) {
        if (!imageMap[img.productId]) {
            imageMap[img.productId] = [];
        }
        imageMap[img.productId].push({
            id: img.id,
            url: img.url,
            altText: img.altText,
            sortOrder: img.sortOrder,
            productId: img.productId,
            variantId: img.variantId, // will be null here
            createdAt: img.createdAt,
            updatedAt: img.updatedAt,
        });
    }
    return imageMap;
}

// Replace existing getTotalProductCount with a unified implementation
async function getTotalProductCount(
    search?: string,
    minPrice?: number,
    maxPrice?: number,
    categoryId?: string,
    collectionId?: string,
    isAdmin?: boolean,
): Promise<number> {
    // Build search and price conditions
    const conditions: any[] = [];
    if (!isAdmin) {
        conditions.push(eq(products.isActive, true));
    }
    if (search) {
        conditions.push(
            or(
                ilike(products.name, `%${search}%`),
                ilike(products.slug, `%${search}%`),
                ilike(products.description, `%${search}%`),
                ilike(products.sku, `%${search}%`)
            )
        );
    }
    if (minPrice !== undefined) {
        conditions.push(gte(products.price, minPrice.toString()));
    }
    if (maxPrice !== undefined) {
        conditions.push(lte(products.price, maxPrice.toString()));
    }

    // Build query with optional category/collection joins
    let query: any = db.select({ count: count() }).from(products);
    if (categoryId) {
        query = query.innerJoin(
            productToCategory,
            eq(productToCategory.productId, products.id)
        );
        if (isUUID(categoryId)) {
            conditions.push(eq(productToCategory.categoryId, categoryId));
        } else {
            const cat = await db.select({ id: categories.id })
                .from(categories)
                .where(eq(categories.slug, categoryId))
                .limit(1);
            if (cat[0]) {
                conditions.push(eq(productToCategory.categoryId, cat[0].id));
            } else {
                conditions.push(sql`1=0`);
            }
        }
    }
    if (collectionId) {
        query = query.innerJoin(
            productToCollection,
            eq(productToCollection.productId, products.id)
        );
        if (isUUID(collectionId)) {
            conditions.push(eq(productToCollection.collectionId, collectionId));
        } else {
            const col = await db.select({ id: collections.id })
                .from(collections)
                .where(eq(collections.slug, collectionId))
                .limit(1);
            if (col[0]) {
                conditions.push(eq(productToCollection.collectionId, col[0].id));
            } else {
                conditions.push(sql`1=0`);
            }
        }
    }

    // Note: ID filtering isn't strictly necessary for total count if we are only fetching specific IDs, 
    // but added here for consistency if needed.
    // if (ids && ids.length) { conditions.push(inArray(products.id, ids)); }

    if (conditions.length) {
        query = query.where(and(...conditions));
    }
    const result = await query;
    return result[0]?.count ?? 0;
}

// Helper function to calculate stock for a list of products (for admins)
async function calculateStockForProducts(productIds: string[]): Promise<Record<string, number>> {
    if (productIds.length === 0) {
        return {};
    }

    // Fetch product info to determine which products have variants
    const productsInfo = await db
        .select({
            id: products.id,
            hasVariants: products.hasVariants
        })
        .from(products)
        .where(inArray(products.id, productIds));

    // Create a map of product IDs to their hasVariants status
    const productVariantMap: Record<string, boolean> = {};
    productsInfo.forEach(product => {
        productVariantMap[product.id] = product.hasVariants;
    });

    // Fetch inventory quantities for all relevant variants
    const variantStock = await db
        .select({
            productId: productVariants.productId,
            quantity: productVariants.inventoryQuantity,
            isActive: productVariants.isActive,
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, productIds));

    // Calculate total stock per product
    const stockMap: Record<string, number> = {};

    // Initialize stock map with zeros for all products
    productIds.forEach(id => {
        stockMap[id] = 0;
    });

    // For products with variants, sum up the quantities of active variants
    for (const variant of variantStock) {
        if (variant.productId && variant.isActive) {
            // Only active variants contribute to total stock
            stockMap[variant.productId] = (stockMap[variant.productId] || 0) + (variant.quantity ?? 0);
        }
    }

    // For products without variants but with hasVariants=true, ensure stock is 0
    // For products with hasVariants=false, their stock should be managed directly on the product
    productsInfo.forEach(product => {
        if (productVariantMap[product.id] && !variantStock.some(v => v.productId === product.id)) {
            // If product has variants flag but no variants found, ensure stock is 0
            stockMap[product.id] = 0;
        }
    });

    return stockMap;
}

// Helper function to compute price overrides for products with variants
async function getVariantPriceOverrides(productIds: string[]): Promise<Record<string, number | string>> {
    if (productIds.length === 0) return {};
    // Fetch active variant prices
    const variantPrices = await db.select({ productId: productVariants.productId, price: productVariants.price })
        .from(productVariants)
        .where(and(
            inArray(productVariants.productId, productIds),
            productVariants.isActive
        ));
    // Group prices by productId
    const priceMap: Record<string, number[]> = {};
    for (const vp of variantPrices) {
        const pid = vp.productId;
        const pr = typeof vp.price === 'string' ? parseFloat(vp.price) : (vp.price ?? 0);
        if (!priceMap[pid]) priceMap[pid] = [];
        priceMap[pid].push(pr);
    }
    // Build override map
    const overrideMap: Record<string, number | string> = {};
    productIds.forEach(pid => {
        const prices = priceMap[pid] || [];
        if (prices.length === 0) {
            return; // no override, use base price
        }
        const unique = Array.from(new Set(prices));
        if (unique.length === 1) {
            overrideMap[pid] = unique[0];
        } else {
            const minPrice = Math.min(...unique);
            overrideMap[pid] = `ابتداءً من ${minPrice.toLocaleString('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0 })}`;
        }
    });
    return overrideMap;
}

export async function listProducts(params: PaginationParams = {}, isAdmin: boolean = false): Promise<PaginatedProductsResult> {
    const { page = 1, limit = 10, search, sortBy, order, minPrice, maxPrice, categoryId, collectionId } = params;
    const offset = (page - 1) * limit;

    // Build combined filter conditions
    const conditions: any[] = [];
    if (search) {
        const searchCondition = or(
            ilike(products.name, `%${search}%`),
            ilike(products.slug, `%${search}%`),
            ilike(products.description, `%${search}%`),
            ilike(products.sku, `%${search}%`)
        );
        conditions.push(searchCondition);
    }
    if (minPrice !== undefined) {
        conditions.push(gte(products.price, minPrice.toString()));
    }
    if (maxPrice !== undefined) {
        conditions.push(lte(products.price, maxPrice.toString()));
    }
    // category/collection filtering handled via joins
    if (categoryId) {
        if (isUUID(categoryId)) {
            conditions.push(eq(productToCategory.categoryId, categoryId));
        } else {
            // Support searching by category slug if it's not a UUID
            // This is useful for system categories like 'hot', 'top-selling', etc.
            const cat = await db.select({ id: categories.id })
                .from(categories)
                .where(eq(categories.slug, categoryId))
                .limit(1);
            if (cat[0]) {
                conditions.push(eq(productToCategory.categoryId, cat[0].id));
            } else {
                // If not found, add a condition that will return nothing rather than everything
                conditions.push(sql`1=0`);
            }
        }
    }
    if (collectionId) {
        if (isUUID(collectionId)) {
            conditions.push(eq(productToCollection.collectionId, collectionId));
        } else {
            const col = await db.select({ id: collections.id })
                .from(collections)
                .where(eq(collections.slug, collectionId))
                .limit(1);
            if (col[0]) {
                conditions.push(eq(productToCollection.collectionId, col[0].id));
            } else {
                conditions.push(sql`1=0`);
            }
        }
    }
    if (params.ids && params.ids.length > 0) {
        conditions.push(inArray(products.id, params.ids));
    }
    if (!isAdmin) {
        conditions.push(eq(products.isActive, true));
    }
    const whereCondition = conditions.length ? and(...conditions) : undefined;

    // Determine order clause
    let orderClause;
    switch (sortBy) {
        case 'price':
            orderClause = order === 'asc' ? asc(products.price) : desc(products.price);
            break;
        case 'name':
            orderClause = order === 'asc' ? asc(products.name) : desc(products.name);
            break;
        case 'createdAt':
            orderClause = order === 'asc' ? asc(products.createdAt) : desc(products.createdAt);
            break;
        default:
            orderClause = desc(products.createdAt);
    }
    // Build main product query, selecting only product columns to avoid nested join objects
    const productSelect = { product: products };
    let productQuery: any = db.select(productSelect).from(products);
    if (categoryId) {
        productQuery = productQuery.innerJoin(
            productToCategory,
            eq(productToCategory.productId, products.id)
        );
    }
    if (collectionId) {
        productQuery = productQuery.innerJoin(
            productToCollection,
            eq(productToCollection.productId, products.id)
        );
    }
    const [dbData, total]: [any[], number] = await Promise.all([
        productQuery
            .where(whereCondition)
            .limit(limit)
            .offset(offset)
            .orderBy(orderClause),
        getTotalProductCount(search, minPrice, maxPrice, categoryId, collectionId, isAdmin)
    ]);

    let stockMap: Record<string, number> = {};
    let imageMap: Record<string, ProductImage[]> = {};
    let overrideMap: Record<string, number | string> = {};
    const productIds = dbData.map((p: any) => (p.product ? p.product.id : p.id));

    // Fetch stock (for admin), images and variant price overrides in parallel
    if (productIds.length > 0) {
        const promises: Promise<any>[] = [];
        if (isAdmin) {
            promises.push(calculateStockForProducts(productIds));
        }
        promises.push(getImagesForProducts(productIds));
        promises.push(getVariantPriceOverrides(productIds));

        const results = await Promise.all(promises);
        if (isAdmin) {
            stockMap = results[0] as Record<string, number>;
            imageMap = results[1] as Record<string, ProductImage[]>;
            overrideMap = results[2] as Record<string, number | string>;
        } else {
            imageMap = results[0] as Record<string, ProductImage[]>;
            overrideMap = results[1] as Record<string, number | string>;
        }
    }

    // Fetch collection mapping for products
    const productCollections: { productId: string; collectionId: string }[] = productIds.length > 0
        ? await db.select({ productId: productToCollection.productId, collectionId: productToCollection.collectionId })
            .from(productToCollection)
            .where(inArray(productToCollection.productId, productIds))
        : [];
    const collectionMap: Record<string, string[]> = {};
    productCollections.forEach(({ productId, collectionId }) => {
        if (!collectionMap[productId]) collectionMap[productId] = [];
        collectionMap[productId].push(collectionId);
    });

    // Fetch all discounts and map to products
    const discountsList = await listDiscounts();

    // Initialize discount map for products
    const discountMap: Record<string, ProductDiscount[]> = {};
    productIds.forEach(pid => { discountMap[pid] = []; });
    // Populate discount map
    discountsList.forEach(discount => {
        // Prepare product discount object
        const pd: ProductDiscount = {
            id: discount.id!,
            name: discount.name,
            type: discount.type,
            value: discount.value ?? null,
            percentage: discount.percentage ?? null,
            bogo: discount.bogo ?? undefined,
            tiered: discount.tiered ?? undefined,
        };
        // product-level discounts
        (discount.productIds ?? []).forEach(pid => {
            if (discountMap[pid]) discountMap[pid].push(pd);
        });
        // variant-level discounts (treat as product discount)
        (discount.variantIds ?? []).forEach(pid => {
            if (discountMap[pid]) discountMap[pid].push(pd);
        });
        // collection-level discounts
        (discount.collectionIds ?? []).forEach((cid: string) => {
            productIds.forEach(pid => {
                if (collectionMap[pid]?.includes(cid)) {
                    discountMap[pid].push(pd);
                }
            });
        });
    });

    // Map raw DB data to Product type, including stock for admins, images for all, price overrides, and discounts
    const data = dbData.map(row => {
        const dbProd = (row as any).product ?? row;
        const actualStock = isAdmin ? (dbProd.hasVariants ? (stockMap[dbProd.id] ?? 0) : dbProd.stock) : dbProd.stock;
        const prod = mapDbProductToProduct(
            dbProd,
            actualStock,
            imageMap[dbProd.id] || [],
            overrideMap[dbProd.id]
        );
        prod.discounts = discountMap[dbProd.id];
        return prod;
    });

    return {
        data: data,
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit),
    };
}

// Helper function to check if a string is a valid UUID
function isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

export async function getProductBySlugOrId(slugOrId: string, isAdmin: boolean = false): Promise<Product | undefined> {
    // Choose query condition based on whether slugOrId looks like a UUID
    let result;

    if (isUUID(slugOrId)) {
        // If it looks like a UUID, query by ID
        result = await db.select()
            .from(products)
            .where(isAdmin ? eq(products.id, slugOrId) : and(eq(products.id, slugOrId), eq(products.isActive, true)));
    } else {
        // Otherwise, query by slug
        result = await db.select()
            .from(products)
            .where(isAdmin ? eq(products.slug, slugOrId) : and(eq(products.slug, slugOrId), eq(products.isActive, true)));
    }

    const dbProduct = result[0];

    if (!dbProduct) {
        return undefined;
    }

    // Get the actual ID from the found product
    const id = dbProduct.id;

    let stock: number | undefined = undefined;
    let override: number | string | undefined;
    let promises: Promise<any>[] = [];

    if (isAdmin) {
        promises.push(calculateStockForProducts([id]));
    }
    // Fetch images for the product
    promises.push(getImagesForProducts([id]));
    promises.push(getVariantPriceOverrides([id]));

    // Handle the case when there are different numbers of promises
    const results = await Promise.all(promises);

    // Build base product
    const stockMap = isAdmin ? (results[0] as Record<string, number>) : undefined;
    const actualStock = isAdmin ? (dbProduct.hasVariants ? (stockMap![id] ?? 0) : dbProduct.stock) : dbProduct.stock;
    const imageMap = results[isAdmin ? 1 : 0] as Record<string, ProductImage[]>;
    const overrideMap = results[isAdmin ? 2 : 1] as Record<string, number | string>;
    const prod = mapDbProductToProduct(
        dbProduct,
        actualStock,
        imageMap[id] || [],
        overrideMap[id]
    );
    // Attach discounts
    const discountsList = await listDiscounts();
    // Get product collections
    const prodCols = await db.select({ collectionId: productToCollection.collectionId })
        .from(productToCollection)
        .where(eq(productToCollection.productId, id));
    const colIds = prodCols.map(c => c.collectionId);
    // Filter applicable discounts
    const singleDiscounts: ProductDiscount[] = [];
    discountsList.forEach(d => {
        const pd: ProductDiscount = {
            id: d.id!, name: d.name, type: d.type,
            value: d.value ?? null, percentage: d.percentage ?? null,
            bogo: d.bogo ?? undefined, tiered: d.tiered ?? undefined,
        };
        if (d.productIds?.includes(id)
            || d.variantIds?.includes(id)
            || d.collectionIds?.some(cid => colIds.includes(cid))) {
            singleDiscounts.push(pd);
        }
    });
    prod.discounts = singleDiscounts;
    return prod;
}

type RelatedProductsOpts = {
    limit?: number;
    userId?: string | null;
    anonymousId?: string | null;
};

// Heuristic + affinity based related products recommender
export async function getRelatedProducts(productId: string, opts: RelatedProductsOpts = {}): Promise<Product[]> {
    const limit = opts.limit ?? 8;

    const targetRow = await db
        .select({
            id: products.id,
            price: products.price,
            hasVariants: products.hasVariants,
            createdAt: products.createdAt,
        })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

    const target = targetRow[0];
    if (!target) return [];

    const targetPrice = parsePrice(target.price);

    const [targetCategories, targetCollections] = await Promise.all([
        db
            .select({ categoryId: productToCategory.categoryId })
            .from(productToCategory)
            .where(eq(productToCategory.productId, productId)),
        db
            .select({ collectionId: productToCollection.collectionId })
            .from(productToCollection)
            .where(eq(productToCollection.productId, productId)),
    ]);

    const targetCategorySet = new Set<string>(targetCategories.map(c => c.categoryId).filter(Boolean));
    const targetCollectionSet = new Set<string>(targetCollections.map(c => c.collectionId).filter(Boolean));

    // Wide candidate pool prioritizing recent items
    const candidateRows = await db
        .select({
            product: products,
            categoryId: productToCategory.categoryId,
            collectionId: productToCollection.collectionId,
        })
        .from(products)
        .leftJoin(productToCategory, eq(productToCategory.productId, products.id))
        .leftJoin(productToCollection, eq(productToCollection.productId, products.id))
        .where(and(eq(products.isActive, true), ne(products.id, productId)))
        .orderBy(desc(products.createdAt))
        .limit(150);

    const candidateMap: Record<string, { product: any; categories: Set<string>; collections: Set<string> }> = {};
    candidateRows.forEach(row => {
        const prod = (row as any).product ?? row;
        const id = prod.id;
        if (!candidateMap[id]) {
            candidateMap[id] = { product: prod, categories: new Set(), collections: new Set() };
        }
        if (row.categoryId) candidateMap[id].categories.add(row.categoryId);
        if (row.collectionId) candidateMap[id].collections.add(row.collectionId);
    });

    const candidateIds = Object.keys(candidateMap);
    if (!candidateIds.length) return [];

    // Popularity & conversion signals (views, add_to_cart, payment_verified)
    const candidateArray = sql`ARRAY[${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)}]::text[]`;

    const popularityRows = await db.execute(sql`
            select
                properties->>'productId' as product_id,
                count(*) filter (where event_name = 'product_view')::int as views,
                count(*) filter (where event_name = 'add_to_cart')::int as add_to_cart,
                count(*) filter (where event_name = 'payment_verified')::int as purchases
            from analytics_events
            where (properties::jsonb) ? 'productId'
                and properties->>'productId' = ANY(${candidateArray})
                and occurred_at >= now() - interval '90 days'
            group by properties->>'productId'
        `);
    const popularityMap: Record<string, { views: number; addToCart: number; purchases: number }> = {};
    for (const row of popularityRows.rows as any[]) {
        popularityMap[row.product_id] = {
            views: Number(row.views ?? 0),
            addToCart: Number(row.add_to_cart ?? 0),
            purchases: Number(row.purchases ?? 0),
        };
    }

    // Affinity (recent views/cart) for this visitor
    let affinityRows: any[] = [];
    if (opts.userId) {
        affinityRows = (await db.execute(sql`
          select properties->>'productId' as product_id, count(*)::int as cnt
                    from analytics_events
                    where (properties::jsonb) ? 'productId'
            and event_name in ('product_view','add_to_cart')
            and user_id = ${opts.userId}
            and occurred_at >= now() - interval '45 days'
          group by properties->>'productId'
          order by max(occurred_at) desc
          limit 30
        `)).rows as any[];
    } else if (opts.anonymousId) {
        affinityRows = (await db.execute(sql`
          select properties->>'productId' as product_id, count(*)::int as cnt
                    from analytics_events
                    where (properties::jsonb) ? 'productId'
            and event_name in ('product_view','add_to_cart')
            and anonymous_id = ${opts.anonymousId}
            and occurred_at >= now() - interval '45 days'
          group by properties->>'productId'
          order by max(occurred_at) desc
          limit 30
        `)).rows as any[];
    }
    const affinityMap: Record<string, number> = {};
    affinityRows.forEach(r => {
        if (r.product_id) {
            affinityMap[r.product_id] = Number(r.cnt ?? 0);
        }
    });

    // Logged-in RFM segment boosts
    let rfmSegment: string | null = null;
    if (opts.userId) {
        const rfmRow = await db.execute(sql`
          select s.segment
                    from analytics_rfm_scores s
                    join analytics_rfm_configs c on c.id = s.config_id
          where c.is_active = true and s.user_id = ${opts.userId}
          order by s.computed_at desc
          limit 1
        `);
        rfmSegment = (rfmRow.rows?.[0] as any)?.segment ?? null;
    }

    const scored = candidateIds.map(id => {
        const entry = candidateMap[id];
        const prod = entry.product;
        const catOverlap = [...entry.categories].filter(cid => targetCategorySet.has(cid)).length;
        const colOverlap = [...entry.collections].filter(cid => targetCollectionSet.has(cid)).length;

        const candidatePrice = parsePrice(prod.price);
        const priceScore = targetPrice > 0 && candidatePrice > 0
            ? Math.max(0, 1 - Math.abs(candidatePrice - targetPrice) / Math.max(targetPrice * 0.4, 1)) * 2.5
            : 0;

        const pop = popularityMap[id] ?? { views: 0, addToCart: 0, purchases: 0 };
        const popularityScore = Math.log(1 + pop.views) * 0.8 + Math.log(1 + pop.addToCart) * 1.1 + pop.purchases * 1.6;

        const affinityScore = affinityMap[id] ? Math.log(1 + affinityMap[id]) * 2 : 0;

        const ageDays = Math.max(1, (Date.now() - new Date(prod.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const recencyScore = Math.min(1, 120 / ageDays) * 0.8;

        const categoryScore = catOverlap * 3;
        const collectionScore = colOverlap * 2;

        let totalScore = categoryScore + collectionScore + priceScore + popularityScore + affinityScore + recencyScore;
        if (rfmSegment) {
            totalScore += 0.5; // small boost when segment is known
        }

        return { id, totalScore };
    })
        .sort((a, b) => b.totalScore - a.totalScore);

    const pickedIds: string[] = [];
    const seen = new Set<string>();
    for (const row of scored) {
        if (pickedIds.length >= limit) break;
        if (!seen.has(row.id)) {
            pickedIds.push(row.id);
            seen.add(row.id);
        }
    }

    // Fallback 1: add top converting if we still need more
    if (pickedIds.length < limit) {
        const byPurchases = scored
            .filter(s => (popularityMap[s.id]?.purchases ?? 0) > 0)
            .sort((a, b) => (popularityMap[b.id]?.purchases ?? 0) - (popularityMap[a.id]?.purchases ?? 0));
        for (const row of byPurchases) {
            if (pickedIds.length >= limit) break;
            if (!seen.has(row.id)) {
                pickedIds.push(row.id);
                seen.add(row.id);
            }
        }
    }

    // Fallback 2: newest arrivals
    if (pickedIds.length < limit) {
        const remainingLimit = limit - pickedIds.length;
        const newestRows = await db
            .select({ product: products })
            .from(products)
            .where(and(eq(products.isActive, true), ne(products.id, productId)))
            .orderBy(desc(products.createdAt))
            .limit(remainingLimit + 5);
        for (const row of newestRows) {
            const pid = (row as any).product?.id ?? (row as any).id;
            if (pid && !seen.has(pid)) {
                pickedIds.push(pid);
                seen.add(pid);
                if (pickedIds.length >= limit) break;
            }
        }
    }

    const finalIds = pickedIds.slice(0, limit);
    const imageMap = await getImagesForProducts(finalIds);
    const overrideMap = await getVariantPriceOverrides(finalIds);

    const data: Product[] = finalIds.map(id => {
        const base = candidateMap[id]?.product;
        return mapDbProductToProduct(base, undefined, imageMap[id] || [], overrideMap[id]);
    });

    return data;
}
export async function createProduct(inputData: unknown): Promise<Product> {
    // Validate input data using Zod schema
    const validatedData = createProductSchema.parse(inputData) as CreateProductInput; // Cast for type safety

    // Separate images from the rest of the data
    const { images, ...productData } = validatedData;

    // Convert price fields to string, handle undefined price by setting to null
    const dataToInsert = {
        // Spread productData includes trackQuantity, width, length, height, weight
        ...productData,
        price: productData.price !== undefined ? productData.price.toString() : null,
        compareAtPrice: productData.compareAtPrice != null ? productData.compareAtPrice.toString() : null,
        // Ensure numeric fields are set to null if undefined
        width: productData.width ?? null,
        length: productData.length ?? null,
        height: productData.height ?? null,
        weight: productData.weight !== undefined ? productData.weight.toString() : null,
    };

    // Use transaction to ensure product and images are created together
    const newProduct = await db.transaction(async (tx) => {
        const result = await tx.insert(products).values(dataToInsert).returning();
        const createdProduct = result[0];

        // Link images if provided
        if (images && images.length > 0) {
            // Add explicit type for img
            const imageValues = images.map((img: ProductImageInput) => ({
                productId: createdProduct.id,
                url: img.url,
                altText: img.altText,
                sortOrder: img.sortOrder ?? 0,
            }));
            await tx.insert(productImages).values(imageValues);
        }
        return createdProduct;
    });

    // Fetch the newly created product with its images to return
    // Note: Stock is not calculated here as it depends on variants created separately
    const finalProduct = await getProductBySlugOrId(newProduct.id, false); // Fetch with images, no need for admin stock here
    if (!finalProduct) {
        // This should not happen if creation and fetch are correct
        throw new Error("Failed to fetch newly created product.");
    }
    return finalProduct;
}

export async function updateProduct(slugOrId: string, inputData: unknown): Promise<Product | undefined> {
    // Find the product first to get its ID
    // Use isAdmin=true so that inactive products can be found and reactivated
    const product = await getProductBySlugOrId(slugOrId, true);
    if (!product) {
        return undefined; // Product not found
    }

    const id = product.id; // Use the actual ID for database operations

    // Validate input data using Zod schema
    const validatedData = updateProductSchema.parse(inputData) as UpdateProductInput; // Cast for type safety

    // Separate images from the rest of the data
    const { images, ...productData } = validatedData;

    if (Object.keys(productData).length === 0 && images === undefined) {
        // If nothing to update (no product fields, no image array passed), return the current product
        return product;
    }

    // Use transaction for update consistency
    const updatedProduct = await db.transaction(async (tx) => {
        let currentProduct: any;
        // Update product fields if any are provided
        if (Object.keys(productData).length > 0) {
            // Convert price fields to string if they exist in the validated data
            const dataToUpdate: Record<string, any> = { ...productData, updatedAt: new Date() };
            // Handle price update (can be set to null if undefined in input)
            if (productData.hasOwnProperty('price')) { // Check if price key exists
                dataToUpdate.price = productData.price !== undefined ? productData.price.toString() : null;
            }
            if (productData.hasOwnProperty('compareAtPrice')) { // Check if compareAtPrice key exists
                dataToUpdate.compareAtPrice = productData.compareAtPrice === null || productData.compareAtPrice === undefined
                    ? null
                    : productData.compareAtPrice.toString();
            }

            const result = await tx.update(products)
                .set(dataToUpdate)
                .where(eq(products.id, id))
                .returning();
            currentProduct = result[0];
        } else {
            // If only images are being updated, fetch the current product data
            const result = await tx.select().from(products).where(eq(products.id, id));
            currentProduct = result[0];
        }

        if (!currentProduct) {
            // Product not found, transaction will rollback
            return undefined;
        }

        // Handle image updates if 'images' array is provided in the input
        if (images !== undefined) {
            // Use isNull for checking null variantId
            await tx.delete(productImages).where(and(eq(productImages.productId, id), isNull(productImages.variantId)));

            // Insert new images if the array is not empty
            if (images.length > 0) {
                // Add explicit type for img
                const imageValues = images.map((img: ProductImageInput) => ({
                    productId: id,
                    url: img.url,
                    altText: img.altText,
                    sortOrder: img.sortOrder ?? 0,
                }));
                await tx.insert(productImages).values(imageValues);
            }
        }
        return currentProduct; // Return the updated product data from DB
    });

    if (!updatedProduct) {
        return undefined; // Product not found during transaction
    }

    // Fetch the final state of the product with potentially updated images
    // Use isAdmin=true so the product is always retrievable regardless of isActive status
    return getProductBySlugOrId(id, true); // Fetch with images
}

export async function deleteProduct(slugOrId: string): Promise<boolean> {
    // Find the product first to get its ID
    // Use isAdmin=true so that inactive products can also be deleted
    const product = await getProductBySlugOrId(slugOrId, true);
    if (!product) {
        return false; // Product not found
    }

    const id = product.id; // Use the actual ID for database operations

    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
}

export async function bulkUpdateProducts(updates: BulkUpdateProductInput): Promise<number> {
    const promises = updates.map(async (update) => {
        try {
            // Re-use updateProduct to ensure consistency (validation, images, etc.)
            await updateProduct(update.id, update.data);
            return true;
        } catch (error) {
            console.error(`Failed to update product ${update.id}:`, error);
            return false;
        }
    });

    const results = await Promise.all(promises);
    return results.filter(Boolean).length;
}
