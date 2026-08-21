import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import { ImageSizes, ProcessedImageInfo, ImageSize } from '../types/imageTypes';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'images');
const PUBLIC_PATH_PREFIX = '/uploads/images'; // Relative path for URLs

// Ensure the upload directory exists
async function ensureUploadDirExists() {
    try {
        await fs.access(UPLOAD_DIR);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(UPLOAD_DIR, { recursive: true });
        } else {
            console.error("Error accessing upload directory:", error);
            throw new Error("لا يمكن الوصول إلى مجلد التحميل أو إنشاؤه");
        }
    }
}

export async function processAndSaveImage(file: File): Promise<ProcessedImageInfo> {
    await ensureUploadDirExists();

    if (!file.type.startsWith('image/')) {
        throw new Error("الملف المُحمّل ليس صورة صالحة.");
    }

    const originalFilename = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    // Generate content-based hash to avoid duplicates
    const baseFilename = createHash('sha256').update(buffer).digest('hex');
    const outputFormat = 'webp';
    const sharpInstance = sharp(buffer);

    const metadata = await sharpInstance.metadata();
    const mimeType = `image/${outputFormat}`;
    const sizeBytes = file.size;

    // --- Check for existing image to skip duplicate processing ---
    const fullDir = path.join(UPLOAD_DIR, 'full');
    await fs.mkdir(fullDir, { recursive: true });
    const fullSavedFilename = `${baseFilename}.${outputFormat}`;
    const fullSavePath = path.join(fullDir, fullSavedFilename);
    try {
        await fs.access(fullSavePath);
        // Image already exists, return existing URLs
        const urls: Record<ImageSize | 'full', string> = {} as any;
        urls['full'] = `${PUBLIC_PATH_PREFIX}/full/${fullSavedFilename}`;
        for (const sizeKey of Object.keys(ImageSizes)) {
            const size = sizeKey as ImageSize;
            urls[size] = `${PUBLIC_PATH_PREFIX}/${size}/${fullSavedFilename}`;
        }
        return {
            originalFilename,
            savedFilename: fullSavedFilename,
            path: urls['full'],
            urls,
            mimeType,
            sizeBytes,
        };
    } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
    }

    const urls: Record<ImageSize | 'full', string> = {} as any;
    const savedPaths: Record<ImageSize | 'full', string> = {} as any;

    // --- Save Full Size Image (converted to WebP) ---
    // Ensure full-size directory
    const fullSizeDir = path.join(UPLOAD_DIR, 'full');
    await fs.mkdir(fullSizeDir, { recursive: true });
    const fullSizeSavedFilename = `${baseFilename}.${outputFormat}`;
    const fullSizeSavePath = path.join(fullSizeDir, fullSizeSavedFilename);
    await sharpInstance
        .webp({ quality: 80 }) // Adjust quality as needed
        .toFile(fullSizeSavePath);
    savedPaths['full'] = fullSizeSavePath;
    urls['full'] = `${PUBLIC_PATH_PREFIX}/full/${fullSizeSavedFilename}`;

    // --- Save Resized Images --- (Thumbnail, Medium, Large)
    for (const [sizeKey, dimensions] of Object.entries(ImageSizes)) {
        const size = sizeKey as ImageSize;
        // Ensure directory for this size
        const sizeDir = path.join(UPLOAD_DIR, size);
        await fs.mkdir(sizeDir, { recursive: true });
        const resizedFilename = `${baseFilename}.${outputFormat}`; // no size suffix, folders separate sizes
        const resizeSavePath = path.join(sizeDir, resizedFilename);

        await sharpInstance
            .resize(dimensions.width, dimensions.height, {
                fit: 'inside', // Or 'cover', depending on desired behavior
                withoutEnlargement: true, // Don't upscale smaller images
            })
            .webp({ quality: 75 }) // Slightly lower quality for smaller sizes
            .toFile(resizeSavePath);

        savedPaths[size] = resizeSavePath;
        urls[size] = `${PUBLIC_PATH_PREFIX}/${size}/${resizedFilename}`;
    }

    return {
        originalFilename,
        savedFilename: fullSizeSavedFilename, // Return the name of the full-size saved file
        path: urls['full'], // Return the public URL path for the full-size image
        urls, // Contains URLs for all sizes: full, thumbnail, medium, large
        mimeType,
        sizeBytes,
    };
}

// Optional: Function to delete images if needed (e.g., when a product is deleted)
export async function deleteImageFiles(baseFilenameWithoutExt: string) {
    try {
        // Delete full and sized images in respective folders
        const filesToDelete = [
            `full/${baseFilenameWithoutExt}.webp`,
            ...Object.keys(ImageSizes).map(size => `${size}/${baseFilenameWithoutExt}.webp`)
        ];

        for (const filename of filesToDelete) {
            const filePath = path.join(UPLOAD_DIR, filename);
            try {
                await fs.unlink(filePath);
                console.log(`Deleted image file: ${filePath}`);
            } catch (error: any) {
                // Ignore ENOENT (file not found) errors, log others
                if (error.code !== 'ENOENT') {
                    console.error(`Error deleting file ${filePath}:`, error);
                }
            }
        }
    } catch (error) {
        console.error(`Error preparing to delete images for base ${baseFilenameWithoutExt}:`, error);
    }
}
