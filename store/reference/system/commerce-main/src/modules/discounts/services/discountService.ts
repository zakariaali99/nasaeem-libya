import { db } from '@/lib/db/drizzle';
import { discounts, productDiscounts, regionalDiscounts, collectionDiscounts } from '@/lib/db/schema';
import { Discount, discountSchema } from '../types/discountTypes';
import { eq, and, inArray } from 'drizzle-orm';

function mapDbDiscountToDiscount(dbDiscount: any): Discount {
  return {
    ...dbDiscount,
    startDate: dbDiscount.startDate ? new Date(dbDiscount.startDate) : undefined,
    endDate: dbDiscount.endDate ? new Date(dbDiscount.endDate) : undefined,
    createdAt: dbDiscount.createdAt ? new Date(dbDiscount.createdAt) : undefined,
    updatedAt: dbDiscount.updatedAt ? new Date(dbDiscount.updatedAt) : undefined,
  };
}

// Enriched discount type with target arrays
export type DiscountWithTargets = Discount & { productIds: string[]; variantIds: string[]; regionIds: string[]; collectionIds: string[] };

async function getDiscountWithTargets(id: string): Promise<DiscountWithTargets | undefined> {
  const dbDiscountArr = await db.select().from(discounts).where(eq(discounts.id, id)).limit(1);
  if (!dbDiscountArr.length) return undefined;
  const dbDiscount = dbDiscountArr[0];
  // Fetch associated targets
  const productLinks = await db.select().from(productDiscounts).where(eq(productDiscounts.discountId, id));
  const regionLinks = await db.select().from(regionalDiscounts).where(eq(regionalDiscounts.discountId, id));
  const collectionLinks = await db.select().from(collectionDiscounts).where(eq(collectionDiscounts.discountId, id));
  return {
    ...mapDbDiscountToDiscount(dbDiscount),
    productIds: productLinks.filter(l => l.productId).map(l => l.productId),
    variantIds: productLinks.map(l => l.variantId).filter((v): v is string => v != null),
    regionIds: regionLinks.map(l => l.regionId),
    collectionIds: collectionLinks.map(l => l.collectionId),
  };
}

export async function listDiscounts(): Promise<DiscountWithTargets[]> {
  const dbDiscounts = await db.select().from(discounts).orderBy(discounts.createdAt);
  // Fetch all targets for each discount
  const results: DiscountWithTargets[] = [];
  for (const dbDiscount of dbDiscounts) {
    const full = await getDiscountWithTargets(dbDiscount.id);
    if (full) results.push(full);
  }
  return results;
}

export async function getDiscountById(id: string): Promise<DiscountWithTargets | undefined> {
  return getDiscountWithTargets(id);
}

export async function createDiscount(inputData: unknown): Promise<DiscountWithTargets> {
  const validated = discountSchema.parse(inputData);
  // Convert number fields to string for decimal columns, null for usageCount
  const toDb = {
    ...validated,
    value: validated.value !== undefined && validated.value !== null ? validated.value.toString() : null,
    percentage: validated.percentage !== undefined && validated.percentage !== null ? validated.percentage.toString() : null,
    deliveryDiscount: validated.deliveryDiscount !== undefined && validated.deliveryDiscount !== null ? validated.deliveryDiscount.toString() : null,
    minOrderAmount: validated.minOrderAmount !== undefined && validated.minOrderAmount !== null ? validated.minOrderAmount.toString() : null,
    maxDiscountAmount: validated.maxDiscountAmount !== undefined && validated.maxDiscountAmount !== null ? validated.maxDiscountAmount.toString() : null,
    bogo: validated.bogo ? JSON.stringify(validated.bogo) : null,
    tiered: validated.tiered ? JSON.stringify(validated.tiered) : null,
    usageCount: validated.usageCount !== undefined && validated.usageCount !== null ? validated.usageCount : 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const [created] = await db.insert(discounts).values(toDb as any).returning();
  const discountId = created.id;

  // Multi-target support
  if (Array.isArray((inputData as any).productIds) && (inputData as any).productIds.length > 0) {
    await db.insert(productDiscounts).values(
      (inputData as any).productIds.map((productId: string) => ({ discountId, productId }))
    );
  }
  if (Array.isArray((inputData as any).variantIds) && (inputData as any).variantIds.length > 0) {
    await db.insert(productDiscounts).values(
      (inputData as any).variantIds.map((variantId: string) => ({ discountId, productId: null, variantId }))
    );
  }
  if (Array.isArray((inputData as any).regionIds) && (inputData as any).regionIds.length > 0) {
    await db.insert(regionalDiscounts).values(
      (inputData as any).regionIds.map((regionId: string) => ({ discountId, regionId }))
    );
  }
  if (Array.isArray((inputData as any).collectionIds) && (inputData as any).collectionIds.length > 0) {
    await db.insert(collectionDiscounts).values(
      (inputData as any).collectionIds.map((collectionId: string) => ({ discountId, collectionId }))
    );
  }

  const result = await getDiscountWithTargets(discountId);
  if (!result) throw new Error('Discount not found after creation');
  return result;
}

export async function updateDiscount(id: string, inputData: unknown): Promise<DiscountWithTargets> {
  const validated = discountSchema.partial().parse(inputData);
  const toDb = {
    ...validated,
    value: validated.value !== undefined && validated.value !== null ? validated.value.toString() : null,
    percentage: validated.percentage !== undefined && validated.percentage !== null ? validated.percentage.toString() : null,
    deliveryDiscount: validated.deliveryDiscount !== undefined && validated.deliveryDiscount !== null ? validated.deliveryDiscount.toString() : null,
    minOrderAmount: validated.minOrderAmount !== undefined && validated.minOrderAmount !== null ? validated.minOrderAmount.toString() : null,
    maxDiscountAmount: validated.maxDiscountAmount !== undefined && validated.maxDiscountAmount !== null ? validated.maxDiscountAmount.toString() : null,
    bogo: validated.bogo ? JSON.stringify(validated.bogo) : null,
    tiered: validated.tiered ? JSON.stringify(validated.tiered) : null,
    usageCount: validated.usageCount !== undefined && validated.usageCount !== null ? validated.usageCount : 0,
    updatedAt: new Date(),
  };
  const [updated] = await db.update(discounts).set(toDb as any).where(eq(discounts.id, id)).returning();
  if (!updated) throw new Error('Discount not found for update');

  // Remove old associations
  await db.delete(productDiscounts).where(eq(productDiscounts.discountId, id));
  await db.delete(regionalDiscounts).where(eq(regionalDiscounts.discountId, id));
  await db.delete(collectionDiscounts).where(eq(collectionDiscounts.discountId, id));

  // Re-insert new associations
  if (Array.isArray((inputData as any).productIds) && (inputData as any).productIds.length > 0) {
    await db.insert(productDiscounts).values(
      (inputData as any).productIds.map((productId: string) => ({ discountId: id, productId }))
    );
  }
  if (Array.isArray((inputData as any).variantIds) && (inputData as any).variantIds.length > 0) {
    await db.insert(productDiscounts).values(
      (inputData as any).variantIds.map((variantId: string) => ({ discountId: id, productId: null, variantId }))
    );
  }
  if (Array.isArray((inputData as any).regionIds) && (inputData as any).regionIds.length > 0) {
    await db.insert(regionalDiscounts).values(
      (inputData as any).regionIds.map((regionId: string) => ({ discountId: id, regionId }))
    );
  }
  if (Array.isArray((inputData as any).collectionIds) && (inputData as any).collectionIds.length > 0) {
    await db.insert(collectionDiscounts).values(
      (inputData as any).collectionIds.map((collectionId: string) => ({ discountId: id, collectionId }))
    );
  }

  const result = await getDiscountWithTargets(id);
  if (!result)
    throw new Error('Discount not found after update');
  return result;
}
export async function deleteDiscount(id: string): Promise<boolean> {
  const deleted = await db.delete(discounts).where(eq(discounts.id, id)).returning();
  return !!deleted.length;
}
