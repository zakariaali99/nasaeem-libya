import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { enqueueRfmBackfill } from "@/modules/analytics/rfm/services/rfmJobService";

const payloadSchema = z.object({
  windowLabel: z.enum(["30d", "90d"]).optional(),
  configId: z.string().uuid().optional(),
  batchSize: z.number().int().min(1).max(5000).optional(),
  offset: z.number().int().min(0).optional(),
  dryRun: z.boolean().optional(),
  userIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession(req);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // allow empty body to use defaults
  }

  try {
    const parsed = payloadSchema.parse(body ?? {});
    const job = await enqueueRfmBackfill(parsed);
    return NextResponse.json({
      message: "تم جدولة إعادة حساب شرائح RFM",
      window: parsed.windowLabel ?? "30d",
      jobId: job?.id ?? null,
    }, { status: 202 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "بيانات غير صالحة", details: error.errors }, { status: 400 });
    }
    console.error("خطأ أثناء جدولة RFM:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جدولة إعادة الحساب" }, { status: 500 });
  }
}
