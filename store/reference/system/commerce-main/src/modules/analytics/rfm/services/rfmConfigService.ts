import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { analyticsRfmConfigs } from "@/lib/db/schema";
import { getCache, setCache, deleteCache } from "@/modules/cache";
import { RfmConfig } from "../types";

const ACTIVE_CACHE_KEY = "analytics:rfm:config:active";
const CONFIG_CACHE_PREFIX = "analytics:rfm:config:";
const CONFIG_CACHE_TTL_SECONDS = 300;

function mapRowToConfig(row: any): RfmConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: Boolean(row.isActive),
    recencyWindowDays: Number(row.recencyWindowDays),
    frequencyWindowDays: Number(row.frequencyWindowDays),
    monetaryWindowDays: Number(row.monetaryWindowDays),
    scale: {
      recency: Array.isArray(row.recencyScale) ? row.recencyScale : [],
      frequency: Array.isArray(row.frequencyScale) ? row.frequencyScale : [],
      monetary: Array.isArray(row.monetaryScale) ? row.monetaryScale : [],
      dimensions: row.dimensions || undefined,
    },
    weights: row.weights || { recency: 1, frequency: 1, monetary: 1 },
    dimensions: row.dimensions || undefined,
  };
}

export async function getActiveConfig(configId?: string): Promise<RfmConfig> {
  const cacheKey = configId ? `${CONFIG_CACHE_PREFIX}${configId}` : ACTIVE_CACHE_KEY;
  const cached = await getCache<RfmConfig>(cacheKey);
  if (cached) return cached;

  const rows = await db
    .select()
    .from(analyticsRfmConfigs)
    .where(configId ? eq(analyticsRfmConfigs.id, configId) : eq(analyticsRfmConfigs.isActive, true))
    .orderBy(desc(analyticsRfmConfigs.updatedAt))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error("لا يوجد إعداد RFM نشط. يرجى إنشاء إعداد من لوحة التحكم.");
  }

  const config = mapRowToConfig(row);
  await setCache(cacheKey, config, CONFIG_CACHE_TTL_SECONDS);
  return config;
}

export async function invalidateConfigCache(configId?: string) {
  const cacheKey = configId ? `${CONFIG_CACHE_PREFIX}${configId}` : ACTIVE_CACHE_KEY;
  await deleteCache(cacheKey);
}
