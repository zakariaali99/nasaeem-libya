import { z } from 'zod';


// Represents an Option (e.g., Color, Size) from the variantOptions table
export interface Option {
    id: string;
    name: string; // e.g., "Color", "Size"
    createdAt: Date;
    updatedAt: Date;
}

// Represents an Option Value (e.g., Red, Small) from the variantValues table
export interface OptionValue {
    id: string;
    optionId: string;
    value: string; // e.g., "Red", "Blue", "S", "M"
    createdAt: Date;
    updatedAt: Date;
}

// Zod schema for creating an Option
export const createOptionSchema = z.object({
    name: z.string().min(1, "اسم الخاصية مطلوب"),
});

// Zod schema for updating an Option
export const updateOptionSchema = createOptionSchema.partial();

// Zod schema for creating an Option Value
export const createOptionValueSchema = z.object({
    // optionId will come from the route parameter, not the body
    value: z.string().min(1, "قيمة الخاصية مطلوبة"),
});

// Zod schema for updating an Option Value
export const updateOptionValueSchema = createOptionValueSchema.partial();


// Type for validated create option data
export type CreateOptionInput = z.infer<typeof createOptionSchema>;

// Type for validated update option data
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;

// Type for validated create option value data
export type CreateOptionValueInput = z.infer<typeof createOptionValueSchema>;

// Type for validated update option value data
export type UpdateOptionValueInput = z.infer<typeof updateOptionValueSchema>;

// Type for pagination parameters
export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
}


// Type for paginated Option list response
export interface PaginatedOptionsResult {
    data: Option[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Type for paginated OptionValue list response
export interface PaginatedOptionValuesResult {
    data: OptionValue[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// An option with its associated values
export interface OptionWithValues extends Option {
    values: OptionValue[];
}
