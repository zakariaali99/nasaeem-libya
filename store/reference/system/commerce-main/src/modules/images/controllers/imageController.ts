import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { ROLES, PERMISSIONS } from "@/lib/rbac";
import * as imageService from "../services/imageService";
import { ImageUploadResponse } from "../types/imageTypes";

export async function uploadImage(req: NextRequest): Promise<NextResponse> {
    // --- Authentication and Authorization ---
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT, ROLES.SEO_SPECIALIST]);
    if (!authResult.success) {
        return authResult.response;
    }

    // --- File Handling ---
    try {
        const formData = await req.formData();
        const file = formData.get('image') as File | null; // 'image' is the expected field name

        if (!file) {
            return NextResponse.json({ message: "لم يتم العثور على ملف صورة في الطلب" }, { status: 400 });
        }

        // --- Process and Save Image ---
        const processedImageData = await imageService.processAndSaveImage(file);

        // --- Success Response ---
        const response: ImageUploadResponse = {
            message: "تم تحميل الصورة ومعالجتها بنجاح",
            data: processedImageData,
        };
        return NextResponse.json(response, { status: 201 });

    } catch (error: any) {
        console.error("Error uploading image:", error);

        // --- Error Handling ---
        if (error.message.includes("الملف المُحمّل ليس صورة صالحة")) {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }
        if (error.message.includes("لا يمكن الوصول إلى مجلد التحميل")) {
            return NextResponse.json({ message: "خطأ في الخادم أثناء معالجة الصورة" }, { status: 500 }); // Don't expose internal path errors
        }
        // Handle potential errors during formData parsing or file processing
        if (error instanceof TypeError && error.message.includes("Failed to parse")) {
            return NextResponse.json({ message: "خطأ في تحليل بيانات النموذج" }, { status: 400 });
        }

        return NextResponse.json({ message: "حدث خطأ غير متوقع أثناء تحميل الصورة" }, { status: 500 });
    }
}

// Note: GET requests for images are handled by Next.js serving static files
// from the `public` directory. No specific controller logic is needed here
// for viewing images, as the URLs provided in the upload response point directly
// to the static files (e.g., /uploads/images/uuid-thumbnail.webp).
