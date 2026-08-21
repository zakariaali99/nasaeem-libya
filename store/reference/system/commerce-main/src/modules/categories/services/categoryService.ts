import { categories, productToCategory, products, productReviews } from '@/lib/db/schema';
import {
    CreateCategoryInput,
    UpdateCategoryInput,
    Category,
    PaginationParams,
    PaginatedCategoriesResult,
    createCategorySchema,
    updateCategorySchema,
    Product // Assuming Product type will be added to categoryTypes.ts
} from '@/modules/categories/types/categoryTypes';
import { db } from '@/lib/db/drizzle';
import { and, count, desc, eq, gt, ilike, or, sql } from 'drizzle-orm'; // Added and, sql

// Helper function to convert raw DB category to Category type
function mapDbToCategory(dbCategory: any, products?: Product[]): Category { // Added products parameter
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    slug: dbCategory.slug,
    description: dbCategory.description,
    parentId: dbCategory.parentId,
    createdAt: dbCategory.createdAt,
    updatedAt: dbCategory.updatedAt,
    products: products || [], // Initialize products array
  };
}

// Helper function to get total count for pagination
async function getTotalCategoryCount(search?: string): Promise<number> {
  const whereCondition = search
    ? or(
        ilike(categories.name, `%${search}%`),
        ilike(categories.description, `%${search}%`)
      )
    : undefined;

  const result = await db.select({ count: count() }).from(categories).where(whereCondition);
  return result[0]?.count ?? 0;
}

export async function listCategories(params: PaginationParams = {}): Promise<PaginatedCategoriesResult> {
  const { page, limit, search } = params;

  const whereCondition = search
    ? or(
        ilike(categories.name, `%${search}%`),
        ilike(categories.slug, `%${search}%`), // Also search by slug
        ilike(categories.description, `%${search}%`)
      )
    : undefined;
  // Get total count first to support unpaginated responses
  const total = await getTotalCategoryCount(search);

  // If no pagination is requested, return all categories
  if (page === undefined && limit === undefined) {
    const allCategories = await db
      .select()
      .from(categories)
      .where(whereCondition)
      .orderBy(desc(categories.createdAt));

    const categoriesWithProducts = await Promise.all(
      allCategories.map(async (cat) => {
        const categoryProducts = await db
          .select({
              id: products.id,
              name: products.name,
              slug: products.slug,
              price: products.price,
              // Add other product fields you want to display in the category view
          })
          .from(products)
          .innerJoin(productToCategory, eq(products.id, productToCategory.productId))
          .where(eq(productToCategory.categoryId, cat.id));
        return mapDbToCategory(cat, categoryProducts as Product[]);
      })
    );

    return {
      data: categoriesWithProducts,
      total,
      page: 1,
      limit: categoriesWithProducts.length,
      totalPages: 1,
    };
  }

  // Fallback to paginated flow when page/limit are provided
  const currentPage = page ?? 1;
  const currentLimit = limit ?? 10;
  const offset = (currentPage - 1) * currentLimit;

  const dbCategories = await db
    .select()
    .from(categories)
    .where(whereCondition)
    .limit(currentLimit)
    .offset(offset)
    .orderBy(desc(categories.createdAt));

  // For each category, fetch its products
  const categoriesWithProducts = await Promise.all(
    dbCategories.map(async (cat) => {
      const categoryProducts = await db
        .select({
            id: products.id,
            name: products.name,
            slug: products.slug,
            price: products.price,
            // Add other product fields you want to display in the category view
        })
        .from(products)
        .innerJoin(productToCategory, eq(products.id, productToCategory.productId))
        .where(eq(productToCategory.categoryId, cat.id));
      return mapDbToCategory(cat, categoryProducts as Product[]);
    })
  );
  return {
    data: categoriesWithProducts,
    total,
    page: currentPage,
    limit: currentLimit,
    totalPages: Math.max(1, Math.ceil(total / currentLimit)),
  };
}

// Create a new category
export async function createCategory(inputData: unknown): Promise<Category> {
    const validatedData = createCategorySchema.parse(inputData);
    const slug = validatedData.slug || validatedData.name.toLowerCase().replace(/\s+/g, '-'); // Auto-generate slug if not provided
    const result = await db.insert(categories).values({ ...validatedData, slug }).returning();
    return mapDbToCategory(result[0]);
}

// Update an existing category
export async function updateCategory(id: string, inputData: unknown): Promise<Category | undefined> {
    // Prevent updates to system categories
    const existing = await db.select({ isSystem: categories.isSystem, slug: categories.slug }).from(categories).where(eq(categories.id, id));
    if (existing[0]?.isSystem) throw new Error('غير مسموح');

    const validatedData = updateCategorySchema.parse(inputData);
    let slugToUpdate: string | undefined = validatedData.slug;
    if (validatedData.name && !validatedData.slug) { // Auto-generate slug if name is updated and slug is not provided
        slugToUpdate = validatedData.name.toLowerCase().replace(/\s+/g, '-');
    }
    const result = await db.update(categories).set({ ...validatedData, slug: slugToUpdate }).where(eq(categories.id, id)).returning();
    return result.length > 0 ? mapDbToCategory(result[0]) : undefined;
}

// Delete a category
export async function deleteCategory(id: string): Promise<boolean> {
    // Prevent deletes of system categories
    const existing = await db.select({ isSystem: categories.isSystem }).from(categories).where(eq(categories.id, id));
    if (existing[0]?.isSystem) return false;

    const result = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result.length > 0;
}

// Get a single category by ID - updated to include products
export async function getCategoryById(id: string): Promise<Category | undefined> {
  const result = await db.select().from(categories).where(eq(categories.id, id));
  const dbCategory = result[0];

  if (!dbCategory) {
    return undefined;
  }

  const categoryProducts = await db
    .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        price: products.price,
        // Add other product fields as needed
    })
    .from(products)
    .innerJoin(productToCategory, eq(products.id, productToCategory.productId))
    .where(eq(productToCategory.categoryId, id));

  return mapDbToCategory(dbCategory, categoryProducts as Product[]);
}

// Assign a product to a category
export async function assignProductToCategory(categoryId: string, productId: string): Promise<void> {
  // Check if the assignment already exists to prevent duplicates
  const existingAssignment = await db
    .select()
    .from(productToCategory)
    .where(and(eq(productToCategory.categoryId, categoryId), eq(productToCategory.productId, productId)))
    .limit(1);

  if (existingAssignment.length === 0) {
    await db.insert(productToCategory).values({ categoryId, productId });
  }
  // Optionally, you could throw an error or return a specific status if it already exists
}

// Remove a product from a category
export async function removeProductFromCategory(categoryId: string, productId: string): Promise<void> {
  await db
    .delete(productToCategory)
    .where(and(eq(productToCategory.categoryId, categoryId), eq(productToCategory.productId, productId)));
}

// Get all products for a category (could be a helper or part of getCategoryById)
export async function getProductsByCategoryId(categoryId: string): Promise<Product[]> {
  // Check if this is a system category by slug
  const cat = await db.select({ slug: categories.slug, isSystem: categories.isSystem })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (cat[0]?.isSystem) {
    switch (cat[0].slug) {
      case 'top-selling':
        return (await db.select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          price: products.price,
        })
          .from(products)
          .leftJoin(productReviews, eq(products.id, productReviews.productId))
          .groupBy(products.id)
          .orderBy(desc(sql`COUNT(product_reviews.id)`))
          .limit(10)) as Product[];
      case 'recently-added':
        return (await db.select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          price: products.price,
        })
          .from(products)
          .orderBy(desc(products.createdAt))
          .limit(10)) as Product[];
      case 'hot': {
        const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return (await db.select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          price: products.price,
        })
          .from(products)
          .leftJoin(productReviews, eq(products.id, productReviews.productId))
          .where(gt(products.createdAt, threshold))
          .groupBy(products.id)
          .orderBy(desc(sql`COUNT(product_reviews.id)`))
          .limit(10)) as Product[];
      }
      default:
        break;
    }
  }
  // Fallback to static assignment table
  const results = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      price: products.price,
    })
    .from(products)
    .innerJoin(productToCategory, eq(products.id, productToCategory.productId))
    .where(eq(productToCategory.categoryId, categoryId));
  return results as Product[];
}