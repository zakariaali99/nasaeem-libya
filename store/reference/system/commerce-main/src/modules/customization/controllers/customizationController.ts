import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import * as customizationService from '../services/customizationService';
import { validateRequest } from '@/lib/api-protection';
import { ROLES, PERMISSIONS } from '@/lib/rbac';

// List all widgets
export async function getWidgets(req: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        const result = await customizationService.listWidgets({ page, limit });
        // Ensure data is always an array
        if (!Array.isArray(result.data)) {
            result.data = [];
        }
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ data: [], message: 'حدث خطأ ما' }, { status: 500 });
    }
}

// Create a new widget (admin only)
export async function createWidget(req: NextRequest): Promise<NextResponse> {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const newWidget = await customizationService.createWidget(body);
        return NextResponse.json(newWidget, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'حدث خطأ ما' }, { status: 400 });
    }
}

// Update an existing widget (admin only)
export async function updateWidget(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
    const { id } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);

    if (!id || typeof id !== 'string') {
        return NextResponse.json({ message: 'معرف غير صالح' }, { status: 400 });
    }

    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const body = await req.json();
        const updatedWidget = await customizationService.updateWidget(id, body);
        if (!updatedWidget) {
            return NextResponse.json({ message: 'العنصر غير موجود' }, { status: 404 });
        }
        return NextResponse.json(updatedWidget);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'حدث خطأ ما' }, { status: 400 });
    }
}

// Delete a widget (admin only)
export async function deleteWidget(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
    const { id } = params;
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);

    if (!id || typeof id !== 'string') {
        return NextResponse.json({ message: 'معرف غير صالح' }, { status: 400 });
    }

    if (!authResult.success) {
        return authResult.response;
    }

    try {
        const success = await customizationService.deleteWidget(id);
        if (!success) {
            return NextResponse.json({ message: 'العنصر غير موجود' }, { status: 404 });
        }
        return NextResponse.json({ message: 'تم الحذف بنجاح' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: 'حدث خطأ ما' }, { status: 500 });
    }
}

// Get a single widget by ID
export async function getWidget(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
    const { id } = params;

    if (!id || typeof id !== 'string') {
        return NextResponse.json({ message: 'معرف غير صالح' }, { status: 400 });
    }

    try {
        const widget = await customizationService.getWidgetById(id);
        if (!widget) {
            return NextResponse.json({ message: 'العنصر غير موجود' }, { status: 404 });
        }
        return NextResponse.json(widget);
    } catch (error) {
        return NextResponse.json({ message: 'حدث خطأ ما' }, { status: 500 });
    }
}

// Update the order of multiple widgets (admin only)
export async function updateWidgetOrder(req: NextRequest): Promise<NextResponse> {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) {
        return authResult.response;
    }
    try {
        const updates = await req.json();
        if (!Array.isArray(updates)) {
            return NextResponse.json({ message: 'البيانات المرسلة غير صالحة' }, { status: 400 });
        }
        await customizationService.batchUpdateWidgets(updates);
        return NextResponse.json({ message: 'تم تحديث العناصر بنجاح' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'حدث خطأ ما' }, { status: 500 });
    }
}

// Revalidate customization cache (admin only)
export async function revalidateCustomization(req: NextRequest): Promise<NextResponse> {
    const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
    if (!authResult.success) {
        return authResult.response;
    }

    try {
        revalidateTag('widgets:all');
        return NextResponse.json({ message: 'تم تحديث التخزين المؤقت للمتجر بنجاح' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'حدث خطأ ما' }, { status: 500 });
    }
}
