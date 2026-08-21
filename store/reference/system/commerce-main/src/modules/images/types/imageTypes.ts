import { z } from 'zod';

export const ImageSizes = {
    thumbnail: { width: 150, height: 150 },
    medium: { width: 600, height: 600 },
    large: { width: 1024, height: 1024 },
};

export type ImageSize = keyof typeof ImageSizes;

export interface ProcessedImageInfo {
    originalFilename: string;
    savedFilename: string; // e.g., uuid.webp
    path: string; // Relative path from public folder, e.g., /uploads/images/uuid.webp
    urls: Record<ImageSize | 'full', string>; // URLs for different sizes + full size
    mimeType: string;
    sizeBytes: number; // Original size
}

// Schema for validating upload requests (if needed, e.g., for metadata)
// For now, we primarily handle the file itself in the controller/service.

// Response type for successful upload
export interface ImageUploadResponse {
    message: string;
    data: ProcessedImageInfo;
}

// Define the structure for a product image
export interface ProductImage {
    id: string;
    productId: string;
    variantId?: string | null; // Optional: Link to a specific variant
    url: string;
    altText?: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

// Zod schema for validating image data when creating/updating
export const productImageSchema = z.object({
    url: z.string().url("رابط الصورة غير صالح"),
    altText: z.string().optional().nullable(),
    sortOrder: z.number().int().optional().default(0),
    // productId and variantId are usually set by the service, not direct input
});

export type ProductImageInput = z.infer<typeof productImageSchema>;
