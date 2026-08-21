import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-protection';
import { ROLES, PERMISSIONS } from '@/lib/rbac';
import { collectionService } from '../services/collectionService';
import {
  insertCollectionSchema,
  updateCollectionSchema,
  manageProductsInCollectionSchema,
  removeProductsFromCollectionSchema,
} from '../types/collectionTypes';
import { z } from 'zod';

// Helper to parse and validate request body
async function parseBody<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T | NextResponse> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "خطأ في التحقق", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: "طلب غير صالح" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
  if (!authResult.success) {
    return authResult.response;
  }

  const parsed = await parseBody(req, insertCollectionSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const newCollection = await collectionService.createCollection(parsed);
    return NextResponse.json(newCollection, { status: 201 });
  } catch (error) {
    console.error("Failed to create collection:", error);
    return NextResponse.json({ message: "فشل إنشاء المجموعة" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, context?: { params?: { collectionId?: string } }) {
  const { searchParams } = new URL(req.url);
  let id = searchParams.get('id');
  const slug = searchParams.get('slug');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  // TODO: Add orderBy and order from searchParams if needed

  // If collectionId is provided in the route parameters, prioritize it
  if (context?.params?.collectionId) {
    id = context.params.collectionId;
  }

  try {
    if (id) {
      const collection = await collectionService.getCollectionById(id);
      if (!collection) {
        return NextResponse.json({ message: "المجموعة غير موجودة" }, { status: 404 });
      }
      return NextResponse.json(collection);
    }
    if (slug) {
      const collection = await collectionService.getCollectionBySlug(slug);
      if (!collection) {
        return NextResponse.json({ message: "المجموعة غير موجودة" }, { status: 404 });
      }
      return NextResponse.json(collection);
    }

    const result = await collectionService.getAllCollections({ page, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch collections:", error);
    return NextResponse.json({ message: "فشل جلب المجموعات" }, { status: 500 });
  }
}

// PUT for a specific collection by ID (from path segment)
export async function PUT(req: NextRequest, { params }: { params: { collectionId: string } }) {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
  if (!authResult.success) {
    return authResult.response;
  }

  const collectionId = params.collectionId;
  if (!collectionId) {
    return NextResponse.json({ message: "معرف المجموعة مطلوب" }, { status: 400 });
  }

  const parsed = await parseBody(req, updateCollectionSchema.omit({ id: true })); // ID comes from path
  if (parsed instanceof NextResponse) return parsed;

  try {
    const updatedCollection = await collectionService.updateCollection(collectionId, parsed);
    if (!updatedCollection) {
      return NextResponse.json({ message: "المجموعة غير موجودة أو فشل التحديث" }, { status: 404 });
    }
    return NextResponse.json(updatedCollection);
  } catch (error) {
    console.error(`Failed to update collection ${collectionId}:`, error);
    return NextResponse.json({ message: "فشل تحديث المجموعة" }, { status: 500 });
  }
}

// DELETE for a specific collection by ID (from path segment)
export async function DELETE(req: NextRequest, { params }: { params: { collectionId: string } }) {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
  if (!authResult.success) {
    return authResult.response;
  }

  const collectionId = params.collectionId;
  if (!collectionId) {
    return NextResponse.json({ message: "معرف المجموعة مطلوب" }, { status: 400 });
  }

  try {
    const success = await collectionService.deleteCollection(collectionId);
    if (!success) {
      return NextResponse.json({ message: "المجموعة غير موجودة أو فشل الحذف" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم حذف المجموعة بنجاح" }, { status: 200 });
  } catch (error) {
    console.error(`Failed to delete collection ${collectionId}:`, error);
    return NextResponse.json({ message: "فشل حذف المجموعة" }, { status: 500 });
  }
}

// --- Product Management in Collections ---

// POST to /api/collections/{collectionId}/products
export async function POST_PRODUCTS(req: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
  if (!authResult.success) {
    return authResult.response;
  }

  const { collectionId } = await params;
  if (!collectionId) {
    return NextResponse.json({ message: "معرف المجموعة مطلوب" }, { status: 400 });
  }

  const parsed = await parseBody(req, manageProductsInCollectionSchema.omit({ collectionId: true }));
  if (parsed instanceof NextResponse) return parsed;

  try {
    await collectionService.addProductsToCollection({ ...parsed, collectionId });
    return NextResponse.json({ message: "تمت إضافة المنتجات إلى المجموعة بنجاح" }, { status: 200 });
  } catch (error) {
    console.error(`Failed to add products to collection ${collectionId}:`, error);
    return NextResponse.json({ message: "فشل إضافة المنتجات إلى المجموعة" }, { status: 500 });
  }
}

// DELETE from /api/collections/{collectionId}/products
// Expects productIds in the body
export async function DELETE_PRODUCTS(req: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
  if (!authResult.success) {
    return authResult.response;
  }

  const { collectionId } = await params;
  if (!collectionId) {
    return NextResponse.json({ message: "معرف المجموعة مطلوب" }, { status: 400 });
  }

  const parsed = await parseBody(req, removeProductsFromCollectionSchema.omit({ collectionId: true }));
  if (parsed instanceof NextResponse) return parsed;

  try {
    await collectionService.removeProductsFromCollection({ ...parsed, collectionId });
    return NextResponse.json({ message: "تمت إزالة المنتجات من المجموعة بنجاح" }, { status: 200 });
  } catch (error) {
    console.error(`Failed to remove products from collection ${collectionId}:`, error);
    return NextResponse.json({ message: "فشل إزالة المنتجات من المجموعة" }, { status: 500 });
  }
}

// GET products for a collection /api/collections/{collectionId}/products
export async function GET_PRODUCTS(req: NextRequest, { params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  if (!collectionId) {
    return NextResponse.json({ message: "معرف المجموعة مطلوب" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    const result = await collectionService.getProductsByCollectionId(collectionId, { page, limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Failed to fetch products for collection ${collectionId}:`, error);
    return NextResponse.json({ message: "فشل جلب منتجات المجموعة" }, { status: 500 });
  }
}
