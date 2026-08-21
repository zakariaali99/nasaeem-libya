// filepath: /Users/monderabusetta/Documents/Projects/wave_commerce/src/modules/categories/controllers/categoriesController.ts
import { NextRequest, NextResponse } from 'next/server';
import * as categoryService from '@/modules/categories/services/categoryService';
import { validateRequest } from '@/lib/api-protection';
import { ROLES, PERMISSIONS } from '@/lib/rbac';
import { PaginationParams } from '@/modules/categories/types/categoryTypes';

// List all categories
export async function getCategories(req: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const pageStr = searchParams.get("page");
    const limitStr = searchParams.get("limit");
    const search = searchParams.get("search") || undefined;

    const params: PaginationParams = {
      page: pageStr ? parseInt(pageStr, 10) : undefined,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
      search,
    };

    // Validate page and limit to be positive integers if provided
    if (params.page !== undefined && (isNaN(params.page) || params.page < 1)) {
      return NextResponse.json({ message: "رقم الصفحة يجب أن يكون رقمًا صحيحًا موجبًا" }, { status: 400 });
    }
    if (params.limit !== undefined && (isNaN(params.limit) || params.limit < 1)) {
      return NextResponse.json({ message: "الحد الأقصى لعدد العناصر في الصفحة يجب أن يكون رقمًا صحيحًا موجبًا" }, { status: 400 });
    }

    const paginatedCategories = await categoryService.listCategories(params);
    return NextResponse.json({ message: "تم جلب الفئات", data: paginatedCategories }, { status: 200 });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ message: "خطأ في جلب الفئات" }, { status: 500 });
  }
}

// Create a new category (admin only)
export async function createCategory(req: NextRequest): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    // The Zod schema in the service will handle validation
    const newCategory = await categoryService.createCategory(body);
    return NextResponse.json({ message: "تم إنشاء الفئة بنجاح", data: newCategory }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating category:", error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: "خطأ في إنشاء الفئة" }, { status: 500 });
  }
}

// Update an existing category (admin only)
export async function updateCategory(req: NextRequest, { params }: { params: { categoryId: string } }): Promise<NextResponse> {
  const { categoryId } = params;
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);

  if (!categoryId || typeof categoryId !== 'string') {
    return NextResponse.json({ message: "معرف الفئة غير صالح" }, { status: 400 });
  }

  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    // The Zod schema in the service will handle validation
    const updatedCategory = await categoryService.updateCategory(categoryId, body);
    if (!updatedCategory) {
      return NextResponse.json({ message: "الفئة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم تحديث الفئة بنجاح", data: updatedCategory }, { status: 200 });
  } catch (error: any) {
    console.error(`Error updating category ${categoryId}:`, error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ message: "بيانات الإدخال غير صالحة", errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: "خطأ في تحديث الفئة" }, { status: 500 });
  }
}

// Delete a category (admin only)
export async function deleteCategory(req: NextRequest, { params }: { params: { categoryId: string } }): Promise<NextResponse> {
  const { categoryId } = params;
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);

  if (!categoryId || typeof categoryId !== 'string') {
    return NextResponse.json({ message: "معرف الفئة غير صالح" }, { status: 400 });
  }

  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const deleted = await categoryService.deleteCategory(categoryId);
    if (!deleted) {
      return NextResponse.json({ message: "الفئة غير موجودة أو فشل الحذف" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error(`Error deleting category ${categoryId}:`, error);
    return NextResponse.json({ message: "خطأ في حذف الفئة" }, { status: 500 });
  }
}

// Get a single category by ID
export async function getCategory(req: NextRequest, { params }: { params: { categoryId: string } }): Promise<NextResponse> {
  const { categoryId } = params;

  if (!categoryId || typeof categoryId !== 'string') {
    return NextResponse.json({ message: "معرف الفئة غير صالح" }, { status: 400 });
  }

  try {
    const category = await categoryService.getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json({ message: "الفئة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم جلب الفئة بنجاح", data: category }, { status: 200 });
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error);
    return NextResponse.json({ message: "خطأ في جلب الفئة" }, { status: 500 });
  }
}

// Assign a product to a category (admin only)
export async function assignProductToCategoryHandler(req: NextRequest, { params }: { params: { categoryId: string } }): Promise<NextResponse> {
  const { categoryId } = params;
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);

  if (!categoryId || typeof categoryId !== 'string') {
    return NextResponse.json({ message: "معرف الفئة غير صالح" }, { status: 400 });
  }

  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    const { productId } = body;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ message: "معرف المنتج مطلوب وغير صالح" }, { status: 400 });
    }

    await categoryService.assignProductToCategory(categoryId, productId);
    return NextResponse.json({ message: "تم تعيين المنتج للفئة بنجاح" }, { status: 200 });
  } catch (error: any) {
    console.error(`Error assigning product to category ${categoryId}:`, error);
    // Handle potential known errors, e.g., if product or category not found by the service layer
    if (error.message === 'Category not found' || error.message === 'Product not found') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return NextResponse.json({ message: "خطأ في تعيين المنتج للفئة" }, { status: 500 });
  }
}

// Remove a product from a category (admin only)
export async function removeProductFromCategoryHandler(req: NextRequest, { params }: { params: { categoryId: string, productId: string } }): Promise<NextResponse> {
  const { categoryId, productId } = params;
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_CONTENT]);

  if (!categoryId || typeof categoryId !== 'string') {
    return NextResponse.json({ message: "معرف الفئة غير صالح" }, { status: 400 });
  }
  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ message: "معرف المنتج غير صالح" }, { status: 400 });
  }

  if (!authResult.success) {
    return authResult.response;
  }

  try {
    await categoryService.removeProductFromCategory(categoryId, productId);
    return NextResponse.json({ message: "تمت إزالة المنتج من الفئة بنجاح" }, { status: 200 }); // Or 204 No Content
  } catch (error) {
    console.error(`Error removing product ${productId} from category ${categoryId}:`, error);
    return NextResponse.json({ message: "خطأ في إزالة المنتج من الفئة" }, { status: 500 });
  }
}

// Get all products for a specific category
export async function getProductsForCategoryHandler(req: NextRequest, { params }: { params: { categoryId: string } }): Promise<NextResponse> {
  const { categoryId } = params;

  if (!categoryId || typeof categoryId !== 'string') {
    return NextResponse.json({ message: "معرف الفئة غير صالح" }, { status: 400 });
  }

  try {
    const products = await categoryService.getProductsByCategoryId(categoryId);
    return NextResponse.json({ message: "تم جلب منتجات الفئة بنجاح", data: products }, { status: 200 });
  } catch (error) {
    console.error(`Error fetching products for category ${categoryId}:`, error);
    return NextResponse.json({ message: "خطأ في جلب منتجات الفئة" }, { status: 500 });
  }
}
