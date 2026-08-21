import { db } from "@/lib/db/drizzle";
import { variantOptions, variantValues, productVariants, productVariantOptions } from "@/lib/db/schema";
import { eq, ilike, count, desc, inArray, and } from "drizzle-orm";
import {
    Option,
    CreateOptionInput,
    UpdateOptionInput,
    PaginationParams,
    PaginatedOptionsResult,
    OptionValue,
    CreateOptionValueInput,
    UpdateOptionValueInput,
    PaginatedOptionValuesResult,
    OptionWithValues
} from "../types/optionTypes";

// Helper to map DB row to Option type
function mapDbToOption(dbOption: typeof variantOptions.$inferSelect): Option {
    return {
        id: dbOption.id,
        name: dbOption.name,
        createdAt: dbOption.createdAt,
        updatedAt: dbOption.updatedAt,
    };
}

// Helper to get total count for options
async function getTotalOptionCount(search?: string): Promise<number> {
    const whereCondition = search ? ilike(variantOptions.name, `%${search}%`) : undefined;
    const result = await db.select({ count: count() }).from(variantOptions).where(whereCondition);
    return result[0]?.count ?? 0;
}

export async function listOptions(params: PaginationParams = {}): Promise<PaginatedOptionsResult> {
    const { page = 1, limit = 10, search } = params;
    const offset = (page - 1) * limit;

    const whereCondition = search ? ilike(variantOptions.name, `%${search}%`) : undefined;

    const [dbData, total] = await Promise.all([
        db.select()
          .from(variantOptions)
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(variantOptions.createdAt)), // Order by creation date
        getTotalOptionCount(search)
    ]);

    const data = dbData.map(mapDbToOption);

    return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getOptionById(id: string): Promise<Option | undefined> {
    const result = await db.select().from(variantOptions).where(eq(variantOptions.id, id));
    const dbOption = result[0];
    return dbOption ? mapDbToOption(dbOption) : undefined;
}

export async function createOption(inputData: CreateOptionInput): Promise<Option> {
    // Validation happens in the controller via Zod
    const result = await db.insert(variantOptions).values(inputData).returning();
    return mapDbToOption(result[0]);
}

export async function updateOption(id: string, inputData: UpdateOptionInput): Promise<Option | undefined> {
    // Validation happens in the controller via Zod
    if (Object.keys(inputData).length === 0) {
        return getOptionById(id);
    }

    const dataToUpdate = { ...inputData, updatedAt: new Date() };

    const result = await db.update(variantOptions)
        .set(dataToUpdate)
        .where(eq(variantOptions.id, id))
        .returning();

    return result[0] ? mapDbToOption(result[0]) : undefined;
}

export async function deleteOption(id: string): Promise<boolean> {
    // Consider implications: deleting an option might require handling associated values or product variants.
    // For now, it just deletes the option itself.
    // You might want to add checks or cascade deletes in the DB schema.
    const result = await db.delete(variantOptions).where(eq(variantOptions.id, id)).returning();
    return result.length > 0;
}

// Get all unique options and their values for a specific product
export async function getOptionsWithValuesByProductId(productId: string): Promise<OptionWithValues[]> {
    const result = await db.selectDistinct({
        optionId: variantOptions.id,
        optionName: variantOptions.name,
        optionCreatedAt: variantOptions.createdAt,
        optionUpdatedAt: variantOptions.updatedAt,
        valueId: variantValues.id,
        value: variantValues.value,
        valueCreatedAt: variantValues.createdAt,
        valueUpdatedAt: variantValues.updatedAt,
    })
    .from(productVariants)
    .innerJoin(productVariantOptions, eq(productVariants.id, productVariantOptions.variantId))
    .innerJoin(variantOptions, eq(productVariantOptions.optionId, variantOptions.id))
    .innerJoin(variantValues, eq(productVariantOptions.valueId, variantValues.id))
    .where(eq(productVariants.productId, productId))
    .orderBy(variantOptions.name, variantValues.value);

    if (!result || result.length === 0) {
        return [];
    }

    // Group values by option
    const optionsMap = new Map<string, OptionWithValues>();

    for (const row of result) {
        if (!optionsMap.has(row.optionId)) {
            optionsMap.set(row.optionId, {
                id: row.optionId,
                name: row.optionName,
                createdAt: row.optionCreatedAt,
                updatedAt: new Date(row.optionUpdatedAt || Date.now()),
                values: [],
            });
        }

        optionsMap.get(row.optionId)!.values.push({
            id: row.valueId,
            optionId: row.optionId,
            value: row.value,
            createdAt: row.valueCreatedAt,
            updatedAt: new Date(row.valueUpdatedAt || Date.now()),
        });
    }

    return Array.from(optionsMap.values());
}

// --- Option Value Service Functions ---

// Helper to map DB row to OptionValue type
function mapDbToOptionValue(dbValue: typeof variantValues.$inferSelect): OptionValue {
    return {
        id: dbValue.id,
        optionId: dbValue.optionId,
        value: dbValue.value,
        createdAt: dbValue.createdAt,
        updatedAt: dbValue.updatedAt,
    };
}

// Helper to get total count for option values within a specific option
async function getTotalOptionValueCount(optionId: string, search?: string): Promise<number> {
    const baseCondition = eq(variantValues.optionId, optionId);
    const searchCondition = search ? ilike(variantValues.value, `%${search}%`) : undefined;
    const whereCondition = search ? and(baseCondition, searchCondition) : baseCondition;

    const result = await db.select({ count: count() }).from(variantValues).where(whereCondition);
    return result[0]?.count ?? 0;
}

export async function listOptionValues(optionId: string, params: PaginationParams = {}): Promise<PaginatedOptionValuesResult> {
    const { page = 1, limit = 10, search } = params;
    const offset = (page - 1) * limit;

    const baseCondition = eq(variantValues.optionId, optionId);
    const searchCondition = search ? ilike(variantValues.value, `%${search}%`) : undefined;
    const whereCondition = search ? and(baseCondition, searchCondition) : baseCondition;

    const [dbData, total] = await Promise.all([
        db.select()
          .from(variantValues)
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(variantValues.createdAt)), // Order by creation date
        getTotalOptionValueCount(optionId, search)
    ]);

    const data = dbData.map(mapDbToOptionValue);

    return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getOptionValueById(id: string): Promise<OptionValue | undefined> {
    const result = await db.select().from(variantValues).where(eq(variantValues.id, id));
    const dbValue = result[0];
    return dbValue ? mapDbToOptionValue(dbValue) : undefined;
}

export async function createOptionValue(optionId: string, inputData: CreateOptionValueInput): Promise<OptionValue> {
    // Validation happens in the controller via Zod
    const dataToInsert = { ...inputData, optionId };
    const result = await db.insert(variantValues).values(dataToInsert).returning();
    return mapDbToOptionValue(result[0]);
}

export async function updateOptionValue(id: string, inputData: UpdateOptionValueInput): Promise<OptionValue | undefined> {
    // Validation happens in the controller via Zod
    if (Object.keys(inputData).length === 0) {
        return getOptionValueById(id);
    }

    const dataToUpdate = { ...inputData, updatedAt: new Date() };

    const result = await db.update(variantValues)
        .set(dataToUpdate)
        .where(eq(variantValues.id, id))
        .returning();

    return result[0] ? mapDbToOptionValue(result[0]) : undefined;
}

export async function deleteOptionValue(id: string): Promise<boolean> {
    // Similar consideration as deleting an option: check for usage in product variants.
    const result = await db.delete(variantValues).where(eq(variantValues.id, id)).returning();
    return result.length > 0;
}
