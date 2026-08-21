import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/drizzle";
import { analyticsRfmConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getActiveConfig, invalidateConfigCache } from "@/modules/analytics/rfm/services/rfmConfigService";

const updateSchema = z.object({
  configId: z.string().uuid().optional(),
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(500).optional().nullable(),
  recencyWindowDays: z.number().int().min(1).max(365).optional(),
  frequencyWindowDays: z.number().int().min(1).max(365).optional(),
  monetaryWindowDays: z.number().int().min(1).max(365).optional(),
  weights: z
    .object({
      recency: z.number().min(0),
      frequency: z.number().min(0),
      monetary: z.number().min(0),
    })
    .partial()
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const config = await getActiveConfig();
    return NextResponse.json({ config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "تعذر جلب إعدادات RFM" }, { status: 404 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession(req);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "البيانات غير صالحة" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة", details: parsed.error.flatten() }, { status: 400 });
  }

  const current = await getActiveConfig(parsed.data.configId).catch(() => null);
  if (!current) {
    return NextResponse.json({ error: "لا يوجد إعداد نشط لتعديله" }, { status: 404 });
  }

  const updates: Record<string, any> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.recencyWindowDays !== undefined) updates.recencyWindowDays = parsed.data.recencyWindowDays;
  if (parsed.data.frequencyWindowDays !== undefined) updates.frequencyWindowDays = parsed.data.frequencyWindowDays;
  if (parsed.data.monetaryWindowDays !== undefined) updates.monetaryWindowDays = parsed.data.monetaryWindowDays;
  if (parsed.data.weights) {
    updates.weights = { ...current.weights, ...parsed.data.weights };
  }
  updates.updatedBy = session.user.id;
  updates.updatedAt = new Date();

  await db.update(analyticsRfmConfigs).set(updates).where(eq(analyticsRfmConfigs.id, current.id));
  await invalidateConfigCache(current.id);
  const fresh = await getActiveConfig(current.id);

  return NextResponse.json({ message: "تم حفظ الإعدادات", config: fresh });
}
