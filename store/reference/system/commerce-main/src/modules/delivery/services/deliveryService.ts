// src/modules/delivery/services/deliveryService.ts

import { db } from "@/lib/db/drizzle";
import { eq, and, desc, ne, or } from "drizzle-orm";
import {
  cities as citiesTable,
  regions as regionsTable,
  deliveryMethods as methodsTable,
  orders,
  orderItems as orderItemsTable,
} from "@/lib/db/schema";
import {
  DeliveryMethodCode,
  DeliveryMethodConfiguration,
  DeliveryOrderItem,
} from "../types/deliveryTypes";
import { createVanexDeliveryMethod } from "../factories/vanexDeliveryFactory";
import { createNawresDeliveryMethod } from "../factories/nawresFactory";
import { createDarbSabeelDeliveryMethod } from "../factories/darbSabeelFactory";
import type { DeliveryMethod } from "../types/deliveryTypes";
import { random } from "gsap";
import { user as userTable } from '@/lib/db/auth-schema';
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";

// Factory registry
const factoryMap: Record<DeliveryMethodCode, (config: Record<string, any>) => DeliveryMethod> = {
  [DeliveryMethodCode.VANEX]: createVanexDeliveryMethod,
  [DeliveryMethodCode.NAWRES]: createNawresDeliveryMethod,
  [DeliveryMethodCode.DARB_SABEEL]: createDarbSabeelDeliveryMethod,
};

async function syncLocationsToActiveProvider(activeConfig: DeliveryMethodConfiguration) {
  // Only enforce credential presence for providers that require them (e.g., Darb Sabeel)
  const accountId = activeConfig.configuration?.accountId
    || activeConfig.configuration?.account_id
    || activeConfig.configuration?.accountID;
  const requiresAccount = activeConfig.code === DeliveryMethodCode.DARB_SABEEL;
  const requiresApiKey = activeConfig.code === DeliveryMethodCode.DARB_SABEEL;

  if ((requiresApiKey && !activeConfig.configuration?.apiKey) || (requiresAccount && !accountId)) {
    console.warn(`[syncLocations] Missing credentials for provider ${activeConfig.code}, skipping location sync`);
    return;
  }
  const instance = await getMethodInstance(activeConfig.code);
  const remoteCities = await instance.listCities();

  await db.transaction(async (tx) => {
    // Soft deactivate all existing locations to avoid FK issues.
    await tx.update(regionsTable).set({ isActive: false });
    await tx.update(citiesTable).set({ isActive: false });

    for (const rc of remoteCities) {
      // Try to match existing city by id, code, or name to reuse rows and avoid unique conflicts.
      const existingCity = await tx.query.cities.findFirst({
        where: or(
          eq(citiesTable.id, rc.id),
          eq(citiesTable.code, rc.id),
          eq(citiesTable.name, rc.name)
        ),
      });

      const cityId = existingCity?.id ?? (rc.id || crypto.randomUUID());
      const cityCode = rc.id || cityId;

      if (existingCity) {
        await tx.update(citiesTable)
          .set({ code: cityCode, name: rc.name, isActive: true, updatedAt: new Date() })
          .where(eq(citiesTable.id, existingCity.id));
      } else {
        await tx.insert(citiesTable)
          .values({ id: cityId, name: rc.name, code: cityCode, isActive: true })
          .onConflictDoNothing();
      }

      // Sync regions for this city
      const remoteRegions = await instance.listRegions(rc.id);
      for (const rr of remoteRegions) {
        const existingRegion = await tx.query.regions.findFirst({
          where: and(eq(regionsTable.cityId, cityId), eq(regionsTable.name, rr.name)),
        });
        const regionId = existingRegion?.id ?? (rr.id || crypto.randomUUID());
        if (existingRegion) {
          await tx.update(regionsTable)
            .set({ name: rr.name, isActive: true, updatedAt: new Date() })
            .where(eq(regionsTable.id, existingRegion.id));
        } else {
          await tx.insert(regionsTable)
            .values({
              id: regionId,
              cityId,
              name: rr.name,
              deliveryFee: "0",
              estimatedDeliveryDays: 0,
              isActive: true,
            })
            .onConflictDoNothing();
        }
      }
    }
  });
}

// Helper to map DB record to configuration interface
function mapDBtoConfig(rec: any): DeliveryMethodConfiguration {
  return {
    id: rec.id,
    code: rec.code as DeliveryMethodCode,
    name: rec.name,
    configuration: rec.configuration,
    isActive: rec.isActive,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

/** Delivery Method Configuration CRUD **/
export async function listDeliveryMethodConfigs(): Promise<DeliveryMethodConfiguration[]> {
  const records = await db.query.deliveryMethods.findMany({ orderBy: desc(methodsTable.createdAt) });
  return records.map(mapDBtoConfig);
}

export async function getDeliveryMethodConfig(id: string): Promise<DeliveryMethodConfiguration | null> {
  const rec = await db.query.deliveryMethods.findFirst({ where: eq(methodsTable.id, id) });
  return rec ? mapDBtoConfig(rec) : null;
}

export async function createDeliveryMethodConfig(data: {
  code: DeliveryMethodCode;
  name: string;
  configuration: Record<string, any>;
  isActive?: boolean;
}): Promise<DeliveryMethodConfiguration> {
  const [rec] = await db.insert(methodsTable)
    .values({
      code: data.code,
      name: data.name,
      description: "",
      configuration: data.configuration,
      isActive: data.isActive ?? true,
    })
    .returning();
  // If this provider is active, deactivate others and clear cached cities/regions
  if (rec.isActive) {
    await db.update(methodsTable)
      .set({ isActive: false })
      .where(ne(methodsTable.id, rec.id))
      .execute();
    await syncLocationsToActiveProvider(mapDBtoConfig(rec));
  }
  return mapDBtoConfig(rec);
}

export async function updateDeliveryMethodConfig(
  id: string,
  updates: Partial<{ name: string; configuration: Record<string, any>; isActive: boolean }>
): Promise<DeliveryMethodConfiguration | null> {
  const ret = await db.update(methodsTable)
    .set(updates)
    .where(eq(methodsTable.id, id))
    .returning();
  if (ret.length) {
    const updated = ret[0];
    // If activated, deactivate others and clear cities/regions
    if (updates.isActive) {
      await db.update(methodsTable)
        .set({ isActive: false })
        .where(ne(methodsTable.id, id))
        .execute();
      await syncLocationsToActiveProvider(mapDBtoConfig(updated));
    }
    return mapDBtoConfig(updated);
  }
  return null;
}

export async function deleteDeliveryMethodConfig(id: string): Promise<boolean> {
  const res = await db.delete(methodsTable).where(eq(methodsTable.id, id));
  return (res.rowCount ?? 0) > 0;
}

/** Cities & Regions CRUD **/
export async function listCities(includeInactive = false): Promise<{ id: string; name: string; code?: string; deliveryFee?: string; isActive: boolean }[]> {
  let rows = await db.query.cities.findMany({
    where: includeInactive ? undefined : eq(citiesTable.isActive, true),
    columns: { id: true, name: true, code: true, deliveryFee: true, isActive: true }
  });
  if (rows.length === 0) {
    const configs = await listDeliveryMethodConfigs();
    const activeConfig = configs.find(c => c.isActive);
    if (activeConfig) {
      const instance = await getMethodInstance(activeConfig.code);
      const remoteCities = await instance.listCities();
      const inserts = remoteCities.map(c => ({ id: c.id, name: c.name, code: c.id, isActive: true }));
      await db.insert(citiesTable).values(inserts).execute();
      rows = await db.query.cities.findMany({
        where: includeInactive ? undefined : eq(citiesTable.isActive, true),
        columns: { id: true, name: true, code: true, deliveryFee: true, isActive: true }
      });
    }
  }
  return rows.map(r => ({ id: r.id, name: r.name, code: r.code || undefined, deliveryFee: r.deliveryFee || undefined, isActive: r.isActive || false }));
}

export async function getCity(id: string) {
  return await db.query.cities.findFirst({ where: eq(citiesTable.id, id) });
}

export async function createCity(data: { name: string; code: string; deliveryFee?: string; isActive?: boolean }) {
  const randomId = crypto.randomUUID(); // Generate a random UUID
  const [rec] = await db.insert(citiesTable)
    .values({ id: randomId, name: data.name, code: data.code, deliveryFee: data.deliveryFee ?? null, isActive: data.isActive ?? true })
    .returning();
  return rec;
}

export async function updateCity(
  id: string,
  updates: Partial<{ name: string; code: string; deliveryFee: string; isActive: boolean }>
) {
  const ret = await db.update(citiesTable)
    .set(updates)
    .where(eq(citiesTable.id, id))
    .returning();
  return ret[0] ?? null;
}

export async function deleteCity(id: string): Promise<boolean> {
  const res = await db.delete(citiesTable).where(eq(citiesTable.id, id));
  return (res.rowCount ?? 0) > 0;
}

export async function listRegions(cityId?: string, includeInactive = false): Promise<{ id: string; name: string; deliveryFee: string; estimatedDeliveryDays: number; isActive: boolean }[]> {
  try {
    console.log(`[listRegions] Starting to fetch regions${cityId ? ` for city: ${cityId}` : ' (all cities)'}`);

    const baseFilter = cityId ? eq(regionsTable.cityId, cityId) : undefined;
    const activeFilter = includeInactive ? undefined : eq(regionsTable.isActive, true);

    let filter;
    if (baseFilter && activeFilter) filter = and(baseFilter, activeFilter);
    else if (baseFilter) filter = baseFilter;
    else if (activeFilter) filter = activeFilter;
    else filter = undefined;

    let rows = await db.query.regions.findMany({
      where: filter,
      columns: { id: true, name: true, deliveryFee: true, estimatedDeliveryDays: true, isActive: true }
    });

    console.log(`[listRegions] Found ${rows.length} regions in database`);

    // If no regions found for a specific city, try to fetch from remote delivery service
    if (rows.length === 0 && cityId) {
      console.log(`[listRegions] No local regions found for city ${cityId}, attempting to fetch from remote service`);

      try {
        const configs = await listDeliveryMethodConfigs();
        const activeConfig = configs.find(c => c.isActive);

        if (!activeConfig) {
          console.warn(`[listRegions] No active delivery method configuration found`);
          return [];
        }
        console.log(`[listRegions] Using active delivery method: ${activeConfig}`);

        console.log(`[listRegions] Using active delivery method: ${activeConfig.code}`);

        const instance = await getMethodInstance(activeConfig.code);
        const cityRec = await getCity(cityId);

        if (!cityRec) {
          console.warn(`[listRegions] City record not found for cityId: ${cityId}`);
          return [];
        }

        const remoteCityId = (cityRec as any)?.code;
        if (!remoteCityId) {
          console.warn(`[listRegions] Remote city code not found for cityId: ${cityId}`);
          return [];
        }

        console.log(`[listRegions] Fetching regions from remote service for remote city: ${remoteCityId}`);
        const remoteRegions = await instance.listRegions(remoteCityId);
        console.log(`[listRegions] Received ${remoteRegions.length} regions from remote service`);

        if (remoteRegions.length > 0) {
          const inserts = remoteRegions.map(r => ({
            id: r.id,
            cityId,
            name: r.name,
            deliveryFee: '0',
            estimatedDeliveryDays: 0,
            isActive: true
          }));

          await db.insert(regionsTable).values(inserts).execute();
          console.log(`[listRegions] Successfully inserted ${inserts.length} regions into database`);

          // Fetch the newly inserted regions
          rows = await db.query.regions.findMany({
            where: filter,
            columns: { id: true, name: true, deliveryFee: true, estimatedDeliveryDays: true, isActive: true }
          });
          console.log(`[listRegions] Retrieved ${rows.length} regions after insertion`);
        }
      } catch (remoteError) {
        console.error(`[listRegions] Error fetching regions from remote service for city ${cityId}:`, remoteError);
        // Don't throw here, return empty array to allow graceful degradation
        console.log(`[listRegions] Falling back to empty regions list due to remote service error`);
      }
    }

    const result = rows.map(r => ({
      id: r.id,
      name: r.name,
      deliveryFee: r.deliveryFee,
      estimatedDeliveryDays: r.estimatedDeliveryDays ?? 0,
      isActive: r.isActive
    }));

    console.log(`[listRegions] Returning ${result.length} regions`);
    return result;

  } catch (error) {
    console.error(`[listRegions] Unexpected error occurred${cityId ? ` for city ${cityId}` : ''}:`, error);
    throw new Error(`فشل في جلب المناطق${cityId ? ` للمدينة ${cityId}` : ''}`);
  }
}

export async function getRegion(id: string) {
  return await db.query.regions.findFirst({ where: eq(regionsTable.id, id) });
}

export async function createRegion(data: { cityId: string; name: string; deliveryFee: string; estimatedDeliveryDays?: number; isActive?: boolean }) {
  const randomId = crypto.randomUUID(); // Generate a random UUID
  const [rec] = await db.insert(regionsTable)
    .values({
      id: randomId,
      cityId: data.cityId,
      name: data.name,
      deliveryFee: data.deliveryFee,
      estimatedDeliveryDays: data.estimatedDeliveryDays,
      isActive: data.isActive ?? true,
    })
    .returning();
  return rec;
}

export async function updateRegion(
  id: string,
  updates: Partial<{ name: string; deliveryFee: string; estimatedDeliveryDays: number; isActive: boolean }>
) {
  const ret = await db.update(regionsTable)
    .set(updates)
    .where(eq(regionsTable.id, id))
    .returning();
  return ret[0] ?? null;
}

export async function deleteRegion(id: string): Promise<boolean> {
  const res = await db.delete(regionsTable).where(eq(regionsTable.id, id));
  return (res.rowCount ?? 0) > 0;
}

/** Delivery Orchestration **/
async function getMethodInstance(code: DeliveryMethodCode): Promise<DeliveryMethod> {
  const rec = await db.query.deliveryMethods.findFirst({ where: eq(methodsTable.code, code) });
  if (!rec) throw new Error("طريقة التوصيل غير معرفة");
  if (!rec.isActive) throw new Error("طريقة التوصيل غير مفعلة");
  const factoryFn = factoryMap[code];
  if (!factoryFn) throw new Error("طريقة التوصيل غير معرفة");
  // rec.configuration may be unknown, cast to proper config type
  return factoryFn(rec.configuration as Record<string, any>);
}

export async function calculateDeliveryPrice(
  method: DeliveryMethodCode,
  destinationCityId: string,
  destinationRegionId: string | null,
  orderDetails: { weight?: number; width?: number; height?: number; length?: number; price: number }
) {
  const instance = await getMethodInstance(method);
  return instance.calculateDeliveryPrice(destinationCityId, destinationRegionId, orderDetails);
}

/**
 * Parameters for starting delivery via the active method.
 */
export type StartActiveDeliveryParams = {
  orderId: string;
  orderNumber: string;
  destinationRegionId?: string | null;
  destinationCityId?: string;
  address: string;
  paymentMethod: PaymentMethodCode;
  orderTotalPrice: number;
  userId?: string;
  orderItems?: DeliveryOrderItem[];
};
/**
 * Start delivery using the currently active delivery method.
 * Fetches city and user contact data internally if needed.
 */
export async function startActiveDelivery(params: StartActiveDeliveryParams) {
  console.log('[startActiveDelivery] Received params:', JSON.stringify(params, null, 2));

  const configs = await listDeliveryMethodConfigs();
  const activeConfig = configs.find((c) => c.isActive);
  if (!activeConfig) {
    return null;
  }

  // Determine cityId and regionId
  let cityId: string | undefined;
  let regionId: string | null = null;

  console.log('[startActiveDelivery] Processing destination params:', {
    destinationRegionId: params.destinationRegionId,
    destinationCityId: params.destinationCityId
  });

  if (params.destinationRegionId) {
    // We have a region, fetch the cityId from it
    console.log('[startActiveDelivery] Using region-based delivery');
    const regionRec = await db.query.regions.findFirst({ where: eq(regionsTable.id, params.destinationRegionId) });
    cityId = regionRec?.cityId;
    regionId = params.destinationRegionId;
    console.log('[startActiveDelivery] Region record found:', { cityId, regionId });
  } else if (params.destinationCityId) {
    // We have a city directly (no regions)
    console.log('[startActiveDelivery] Using city-based delivery');
    cityId = params.destinationCityId;
    regionId = null;
    console.log('[startActiveDelivery] Using city directly:', { cityId, regionId });
  } else {
    console.error('[startActiveDelivery] Neither region nor city ID provided:', params);
    throw new Error("يجب تحديد معرف المدينة أو المنطقة");
  }

  if (!cityId) {
    throw new Error("لم يتم العثور على معرف المدينة");
  }

  // Fetch user contact info
  let contactName = '';
  let contactPhone = '';
  if (params.userId) {
    const userRec = await db.query.user.findFirst({ where: eq(userTable.id, params.userId) });
    contactName = userRec?.name || '';
    contactPhone = userRec?.phoneNumber || '';
  }

  const items: DeliveryOrderItem[] = params.orderItems
    ? params.orderItems
    : (await db.query.orderItems.findMany({
      where: eq(orderItemsTable.orderId, params.orderId),
    })).map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      price: item.price?.toString?.() ?? undefined,
      metadata: (item.metadata as Record<string, any> | null | undefined) ?? undefined,
    }));

  const totalDimensions = items.reduce(
    (sum, item) => {
      // Assume item.metadata contains { weight, width, height, length }
      const meta = (item.metadata ?? {}) as { weight?: number; width?: number; height?: number; length?: number };
      return {
        weight: (sum.weight || 0) + (meta.weight || 0),
        width: (sum.width || 0) + (meta.width || 0),
        height: (sum.height || 0) + (meta.height || 0),
        length: (sum.length || 0) + (meta.length || 0),
        qty: (sum.qty || 0) + (item.quantity || 0),
      };
    },
    { weight: 0, width: 0, height: 0, length: 0, qty: 0 }
  );
  // Initiate delivery
  const result = await startDelivery(activeConfig.code, {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    destinationCityId: cityId,
    destinationRegionId: regionId,
    address: params.address,
    contactName,
    contactPhone,
    paymentMethod: params.paymentMethod,
    orderDetails: {
      weight: totalDimensions.weight,
      width: totalDimensions.width,
      height: totalDimensions.height,
      length: totalDimensions.length,
      qty: totalDimensions.qty,
      price: [PaymentMethodCode.MANUAL_PAYMENT, PaymentMethodCode.BANK_CARDS_ON_DELIVERY].includes(params.paymentMethod) ? params.orderTotalPrice : 0,
    },
    items,
  });
  if (!result) {
    throw new Error("فشل بدء التوصيل");
  }

  if (!result.success) {
    throw new Error(result.message || "فشل بدء التوصيل");
  }

  // Save tracking number only if it exists
  if (result.trackingNumber) {
    const trackingStr = String(result.trackingNumber);
    await db.update(orders).set({ trackingNumber: trackingStr }).where(eq(orders.id, params.orderId)).execute();
  }
  return result;
}

/**
 * Calculate delivery fee using the currently active delivery method.
 * @returns An object with success flag, numeric price, and optional message.
 */
export async function calculateActiveDeliveryPrice(
  destinationCityId: string,
  destinationRegionId: string | null,
  orderDetails: { weight?: number; width?: number; height?: number; length?: number; price: number }
): Promise<{ success: boolean; price: number; message?: string }> {
  const configs = await listDeliveryMethodConfigs();
  const activeConfig = configs.find((c) => c.isActive);
  if (!activeConfig) {
    throw new Error("لا توجد طريقة توصيل مفعلة");
  }
  const result = await calculateDeliveryPrice(
    activeConfig.code,
    destinationCityId,
    destinationRegionId,
    orderDetails
  );
  // Parse returned price string into number
  let priceNum = 0;
  if (result.success && result.price) {
    priceNum = parseFloat(result.price);
  }
  return { success: result.success, price: priceNum, message: result.message };
}

export async function startDelivery(
  method: DeliveryMethodCode,
  params: Parameters<NonNullable<DeliveryMethod["startDelivery"]>>[0]
) {
  const instance = await getMethodInstance(method);
  if (!instance.startDelivery) throw new Error("بدء التوصيل غير مدعوم لهذه الطريقة");
  return await instance.startDelivery(params);
}

/**
 * Handle webhook for a specific delivery method
 */
export async function handleWebhook(
  methodCode: DeliveryMethodCode,
  payload: Record<string, any>,
  headers: Record<string, string>,
  rawBody?: string
): Promise<{ success: boolean }> {
  try {
    // Get the active method configuration
    const configs = await listDeliveryMethodConfigs();
    const activeConfig = configs.find(c => c.code === methodCode && c.isActive);

    if (!activeConfig) {
      console.error(`No active delivery method found for code: ${methodCode}`);
      return { success: false };
    }

    // Get the method instance
    const factory = factoryMap[methodCode];
    if (!factory) {
      console.error(`No factory found for delivery method: ${methodCode}`);
      return { success: false };
    }

    const instance = factory(activeConfig.configuration);
    if (!instance.handleWebhook) {
      console.error(`Webhook handling not supported for delivery method: ${methodCode}`);
      return { success: false };
    }

    // Call the method-specific webhook handler
    return await instance.handleWebhook(payload, headers, activeConfig.configuration, rawBody);
  } catch (error) {
    console.error(`Error handling webhook for delivery method ${methodCode}:`, error);
    return { success: false };
  }
}
