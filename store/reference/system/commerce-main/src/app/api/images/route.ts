import { NextRequest, NextResponse } from 'next/server';
import * as imageController from '@/modules/images/controllers/imageController';

// Handle POST requests for uploading images
export async function POST(req: NextRequest) {
    try {
        // Delegate the request handling to the image controller
        return await imageController.uploadImage(req);
    } catch (error) {
        // Generic fallback error handler for unexpected issues in the route handler itself
        console.error("Unexpected error in image API route:", error);
        return NextResponse.json({ message: "حدث خطأ غير متوقع في خادم ال API" }, { status: 500 });
    }
}

// GET requests are implicitly handled by Next.js serving static files
// from the `public` directory. The URLs returned by the POST request
// point directly to these static assets.
