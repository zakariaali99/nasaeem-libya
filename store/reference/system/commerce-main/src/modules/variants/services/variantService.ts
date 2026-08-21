import { db } from "@/lib/db/drizzle";
import {
    products,
    productVariants,
    productVariantOptions,
    variantOptions,
    variantValues,
    productImages,
} from "@/lib/db/schema";
// Import isNull and isNotNull for Drizzle null checks
import { eq, ilike, or, count, and, desc, inArray, asc, isNull, isNotNull } from "drizzle-orm";
import {
    ProductVariant,
    PaginationParams,
    PaginatedProductVariantsResult,
    VariantOptionValue,
    CreateProductVariantInput,
    UpdateProductVariantInput,
} from "../types/variantTypes";
import { createProductVariantSchema, updateProductVariantSchema } from "../types/variantTypes";
import { ProductImage, ProductImageInput } from "@/modules/images/types/imageTypes"; // Import ProductImageInput

// Helper function to convert raw DB variant and its options/images to ProductVariant type
function mapDbVariantToVariant(dbVariant: any, dbOptions?: any[], dbImages?: ProductImage[]): ProductVariant {
    const options: VariantOptionValue[] = (dbOptions || [])
        .filter(opt => opt.variantOption && opt.variantValue) // Ensure related data exists
        .map(opt => ({
            optionId: opt.variantOption.id,
            valueId: opt.variantValue.id,
            optionName: opt.variantOption.name,
            value: opt.variantValue.value,
        }));

    return {
        id: dbVariant.id,
        title: dbVariant.title || generateVariantTitle(options), // Use title or generate from options
        productId: dbVariant.productId,
        sku: dbVariant.sku,
        barcode: dbVariant.barcode,
        price: typeof dbVariant.price === 'string' ? parseFloat(dbVariant.price) : (dbVariant.price ?? 0),
        compareAtPrice: dbVariant.compareAtPrice === null || dbVariant.compareAtPrice === undefined
            ? null
            : (typeof dbVariant.compareAtPrice === 'string' ? parseFloat(dbVariant.compareAtPrice) : dbVariant.compareAtPrice),
        inventoryQuantity: dbVariant.inventoryQuantity,
        isActive: dbVariant.isActive,
        createdAt: dbVariant.createdAt,
        updatedAt: dbVariant.updatedAt,
        options: options, // Include the mapped options
        images: dbImages, // Include images
    };
}

// Helper function to get total count for pagination
async function getTotalProductCount(search?: string): Promise<number> {
    const whereCondition = search
        ? or(
            ilike(products.name, `%${search}%`),
            ilike(products.description, `%${search}%`),
            ilike(products.sku, `%${search}%`)
          )
        : undefined;

    const result = await db.select({ count: count() }).from(products).where(whereCondition);
    return result[0]?.count ?? 0;
}

// Helper function to get total variant count for pagination
async function getTotalVariantCount(productId?: string, search?: string): Promise<number> {
    const conditions = [];
    if (productId) {
        conditions.push(eq(productVariants.productId, productId));
    }
    if (search) {
        conditions.push(or(
            ilike(productVariants.sku, `%${search}%`),
            ilike(productVariants.barcode, `%${search}%`)
            // Add other searchable fields if needed
        ));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db.select({ count: count() }).from(productVariants).where(whereCondition);
    return result[0]?.count ?? 0;
}

// Helper function to get images for a list of variants
async function getImagesForVariants(variantIds: string[]): Promise<Record<string, ProductImage[]>> {
    if (variantIds.length === 0) return {};

    const dbImages = await db.select()
        .from(productImages)
        .where(and(
            inArray(productImages.variantId, variantIds),
            isNotNull(productImages.variantId) // Use isNotNull for checking non-null variantId
        ))
        .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt)); // Order by sortOrder, then creation date

    const imageMap: Record<string, ProductImage[]> = {};
    for (const img of dbImages) {
        // Since we filtered by non-null variantId, img.variantId should exist
        const variantId = img.variantId!;
        if (!imageMap[variantId]) {
            imageMap[variantId] = [];
        }
        imageMap[variantId].push({
            id: img.id,
            url: img.url,
            altText: img.altText,
            sortOrder: img.sortOrder,
            productId: img.productId,
            variantId: img.variantId,
            createdAt: img.createdAt,
            updatedAt: img.updatedAt,
        });
    }
    return imageMap;
}


// List product variants with pagination and optional filtering
export async function listVariants(params: PaginationParams = {}): Promise<PaginatedProductVariantsResult> {
    const { page = 1, limit = 10, search, productId } = params;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (productId) {
        conditions.push(eq(productVariants.productId, productId));
    }
    if (search) {
        conditions.push(or(
            ilike(productVariants.sku, `%${search}%`),
            ilike(productVariants.barcode, `%${search}%`)
        ));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch variants first
    const dbVariants = await db.select()
        .from(productVariants)
        .where(whereCondition)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(productVariants.createdAt)); // Order by creation date

    const variantIds = dbVariants.map(v => v.id);
    let variantOptionsData: any[] = [];
    let imageMap: Record<string, ProductImage[]> = {};

    // If variants were found, fetch their options and images
    if (variantIds.length > 0) {
        const [optionsResult, imagesResult] = await Promise.all([
            db.select({
                variantId: productVariantOptions.variantId,
                variantOption: variantOptions,
                variantValue: variantValues,
            })
            .from(productVariantOptions)
            .innerJoin(variantOptions, eq(productVariantOptions.optionId, variantOptions.id))
            .innerJoin(variantValues, eq(productVariantOptions.valueId, variantValues.id))
            .where(inArray(productVariantOptions.variantId, variantIds)),
            getImagesForVariants(variantIds) // Fetch images
        ]);
        variantOptionsData = optionsResult;
        imageMap = imagesResult;
    }

    // Group options by variantId
    const optionsByVariantId = variantOptionsData.reduce((acc, opt) => {
        const id = opt.variantId;
        if (!acc[id]) {
            acc[id] = [];
        }
        acc[id].push(opt);
        return acc;
    }, {} as Record<string, any[]>);

    // Map variants and their options/images
    const data = dbVariants.map(dbVariant => mapDbVariantToVariant(
        dbVariant,
        optionsByVariantId[dbVariant.id],
        imageMap[dbVariant.id] // Pass images
    ));

    // Get total count matching the criteria
    const total = await getTotalVariantCount(productId, search);

    return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

// Get all variants for a specific product ID, including their options and images
export async function getVariantsByProductId(productId: string): Promise<ProductVariant[]> {
    // Fetch all variants for the given product ID
    const dbVariants = await db.select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId))
        .orderBy(desc(productVariants.createdAt));

    if (dbVariants.length === 0) {
        return [];
    }

    const variantIds = dbVariants.map(v => v.id);
    let variantOptionsData: any[] = [];
    let imageMap: Record<string, ProductImage[]> = {};

    // If variants were found, fetch their options and images
    if (variantIds.length > 0) {
        const [optionsResult, imagesResult] = await Promise.all([
            db.select({
                variantId: productVariantOptions.variantId,
                variantOption: variantOptions,
                variantValue: variantValues,
            })
            .from(productVariantOptions)
            .innerJoin(variantOptions, eq(productVariantOptions.optionId, variantOptions.id))
            .innerJoin(variantValues, eq(productVariantOptions.valueId, variantValues.id))
            .where(inArray(productVariantOptions.variantId, variantIds)),
            getImagesForVariants(variantIds) // Fetch images
        ]);
        variantOptionsData = optionsResult;
        imageMap = imagesResult;
    }

    // Group options by variantId
    const optionsByVariantId = variantOptionsData.reduce((acc, opt) => {
        const id = opt.variantId;
        if (!acc[id]) {
            acc[id] = [];
        }
        acc[id].push(opt);
        return acc;
    }, {} as Record<string, any[]>);

    // Map variants and their options/images
    const data = dbVariants.map(dbVariant => mapDbVariantToVariant(
        dbVariant,
        optionsByVariantId[dbVariant.id],
        imageMap[dbVariant.id] // Pass images
    ));

    return data;
}

// Get a single product variant by its ID, including its options and images
export async function getVariantById(id: string): Promise<ProductVariant | undefined> {
    // Fetch the variant
    const variantResult = await db.select().from(productVariants).where(eq(productVariants.id, id));
    const dbVariant = variantResult[0];

    if (!dbVariant) {
        return undefined;
    }

    // Fetch the options and images for this variant in parallel
    const [dbOptions, imageMap] = await Promise.all([
        db.select({
            variantId: productVariantOptions.variantId,
            variantOption: variantOptions,
            variantValue: variantValues,
        })
        .from(productVariantOptions)
        .innerJoin(variantOptions, eq(productVariantOptions.optionId, variantOptions.id))
        .innerJoin(variantValues, eq(productVariantOptions.valueId, variantValues.id))
        .where(eq(productVariantOptions.variantId, id)),
        getImagesForVariants([id]) // Fetch images
    ]);

    const images = imageMap[id]; // Get images for this specific variant

    return mapDbVariantToVariant(dbVariant, dbOptions, images); // Pass images to mapper
}

// Helper to generate variant title from options (Arabic, RTL, slash-separated)
function generateVariantTitle(options?: { optionName?: string; value?: string }[]): string {
    if (!options || options.length === 0) return '';
    // Only use value, or 'option: value' if multiple options have the same value
    return options.map(opt => opt.value || '').join(' / ');
}

// Create a new product variant with its options and images
export async function createVariant(inputData: unknown): Promise<ProductVariant> {
    const validatedData: CreateProductVariantInput = createProductVariantSchema.parse(inputData);

    const { options, images, ...variantData } = validatedData; // Separate images

    // Generate title from options
    const title = generateVariantTitle(options);

    // Convert price fields to string for Drizzle insertion with decimal columns
    const dataToInsert = {
        ...variantData,
        title,
        price: variantData.price.toString(),
        compareAtPrice: variantData.compareAtPrice?.toString() ?? null,
    };

    // Use a transaction to ensure atomicity
    const newVariant = await db.transaction(async (tx) => {
        // Insert the variant
        const variantResult = await tx.insert(productVariants).values(dataToInsert).returning();
        const createdVariant = variantResult[0];

        let createdOptions: any[] = [];
        // If options are provided, insert them into the junction table
        if (options && options.length > 0) {
            // Process options - either use existing ones or create new ones
            const optionValuesToInsert = await Promise.all(options.map(async (opt) => {
                let optionId = opt.optionId;
                let valueId = opt.valueId;
                
                // If the option IDs are temporary (starting with 'temp-'), create or find real options
                if (opt.optionId.startsWith('temp-') && opt.optionName) {
                    // Try to find existing option by name
                    const existingOptions = await tx.select().from(variantOptions)
                        .where(eq(variantOptions.name, opt.optionName));
                    
                    if (existingOptions.length > 0) {
                        // Use existing option
                        optionId = existingOptions[0].id;
                    } else {
                        // Create new option
                        const newOption = await tx.insert(variantOptions).values({
                            name: opt.optionName
                        }).returning();
                        optionId = newOption[0].id;
                    }
                }
                
                // If value IDs are temporary and we have the value, create or find real values
                if (opt.valueId.startsWith('temp-') && opt.value) {
                    // Try to find existing value by name and option
                    const existingValues = await tx.select().from(variantValues)
                        .where(and(
                            eq(variantValues.optionId, optionId),
                            eq(variantValues.value, opt.value)
                        ));
                    
                    if (existingValues.length > 0) {
                        // Use existing value
                        valueId = existingValues[0].id;
                    } else {
                        // Create new value
                        const newValue = await tx.insert(variantValues).values({
                            optionId,
                            value: opt.value
                        }).returning();
                        valueId = newValue[0].id;
                    }
                }
                
                return {
                    variantId: createdVariant.id,
                    optionId,
                    valueId,
                };
            }));
            
            // Insert the resolved options
            await tx.insert(productVariantOptions).values(optionValuesToInsert);

            // Fetch the newly created options details for the response
            createdOptions = await tx.select({
                variantId: productVariantOptions.variantId,
                variantOption: variantOptions,
                variantValue: variantValues,
            })
            .from(productVariantOptions)
            .innerJoin(variantOptions, eq(productVariantOptions.optionId, variantOptions.id))
            .innerJoin(variantValues, eq(productVariantOptions.valueId, variantValues.id))
            .where(eq(productVariantOptions.variantId, createdVariant.id));
        }

        let createdImages: ProductImage[] = [];
        // If images are provided, insert them
        if (images && images.length > 0) {
            // Add explicit type for img
            const imageValues = images.map((img: ProductImageInput) => ({
                productId: createdVariant.productId, // Link to the parent product
                variantId: createdVariant.id, // Link to this specific variant
                url: img.url,
                altText: img.altText,
                sortOrder: img.sortOrder ?? 0,
            }));
            const insertedImages = await tx.insert(productImages).values(imageValues).returning();
            createdImages = insertedImages.map(img => ({ // Map DB result to ProductImage type
                 id: img.id,
                 url: img.url,
                 altText: img.altText,
                 sortOrder: img.sortOrder,
                 productId: img.productId,
                 variantId: img.variantId,
                 createdAt: img.createdAt,
                 updatedAt: img.updatedAt,
            }));
        }

        return mapDbVariantToVariant(createdVariant, createdOptions, createdImages); // Pass images
    });

    return newVariant;
}

// Update an existing product variant and its options/images
export async function updateVariant(id: string, inputData: unknown): Promise<ProductVariant | undefined> {
    const validatedData: UpdateProductVariantInput = updateProductVariantSchema.parse(inputData);

    const { options, images, ...variantData } = validatedData; // Separate images

    // Generate title from options if provided
    let title: string | undefined = undefined;
    if (options) {
        title = generateVariantTitle(options);
    }

    // Convert price fields to string if they exist
    const dataToUpdate: Record<string, any> = { ...variantData, updatedAt: new Date() };
    if (title !== undefined) {
        dataToUpdate.title = title;
    }
    if (variantData.price !== undefined) {
        dataToUpdate.price = variantData.price.toString();
    }
    if (variantData.compareAtPrice !== undefined) {
        dataToUpdate.compareAtPrice = variantData.compareAtPrice === null ? null : variantData.compareAtPrice.toString();
    }

    // Use a transaction
    const updatedVariant = await db.transaction(async (tx) => {
        let variantResult;
        // Update variant details if provided
        if (Object.keys(variantData).length > 0) {
            variantResult = await tx.update(productVariants)
                .set(dataToUpdate)
                .where(eq(productVariants.id, id))
                .returning();
        } else {
            // If only options/images are updated, fetch the current variant data
            const currentVariant = await tx.select().from(productVariants).where(eq(productVariants.id, id));
            variantResult = currentVariant;
        }

        const variant = variantResult[0];
        if (!variant) return undefined; // Variant not found

        let finalOptions: any[] = [];
        // Handle options update if provided
        if (options !== undefined) {
            // Delete existing options for this variant
            await tx.delete(productVariantOptions).where(eq(productVariantOptions.variantId, id));

            // Insert new options if the array is not empty
            if (options.length > 0) {
                const optionValuesToInsert = options.map(opt => ({
                    variantId: id,
                    optionId: opt.optionId,
                    valueId: opt.valueId,
                }));
                await tx.insert(productVariantOptions).values(optionValuesToInsert);
            }
        }

        // Fetch the final state of options for the response
        finalOptions = await tx.select({
            variantId: productVariantOptions.variantId,
            variantOption: variantOptions,
            variantValue: variantValues,
        })
        .from(productVariantOptions)
        .innerJoin(variantOptions, eq(productVariantOptions.optionId, variantOptions.id))
        .innerJoin(variantValues, eq(productVariantOptions.valueId, variantValues.id))
        .where(eq(productVariantOptions.variantId, id));

        let finalImages: ProductImage[] = [];
        // Handle images update if provided
        if (images !== undefined) {
            // Delete existing images for this variant
            await tx.delete(productImages).where(eq(productImages.variantId, id));

            // Insert new images if the array is not empty
            if (images.length > 0) {
                // Add explicit type for img
                const imageValues = images.map((img: ProductImageInput) => ({
                    productId: variant.productId, // Get productId from the variant being updated
                    variantId: id,
                    url: img.url,
                    altText: img.altText,
                    sortOrder: img.sortOrder ?? 0,
                }));
                await tx.insert(productImages).values(imageValues);
            }
        }

        // Fetch the final state of images for the response
        const dbImages = await tx.select()
            .from(productImages)
            .where(eq(productImages.variantId, id))
            .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));

        finalImages = dbImages.map(img => ({ // Map DB result to ProductImage type
             id: img.id,
             url: img.url,
             altText: img.altText,
             sortOrder: img.sortOrder,
             productId: img.productId,
             variantId: img.variantId,
             createdAt: img.createdAt,
             updatedAt: img.updatedAt,
        }));


        return mapDbVariantToVariant(variant, finalOptions, finalImages); // Pass final images
    });

    return updatedVariant;
}

// Delete a product variant (cascade delete should handle productVariantOptions and productImages linked by variantId)
export async function deleteVariant(id: string): Promise<boolean> {
    // Assuming cascade delete is set up in the database schema for productVariantOptions and productImages
    // If not, you would need to explicitly delete from those tables first.
    // Example: await db.delete(productImages).where(eq(productImages.variantId, id));
    const result = await db.delete(productVariants).where(eq(productVariants.id, id)).returning();
    return result.length > 0;
}
