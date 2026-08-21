import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scheduleNightlyRfm } from "@/modules/analytics/rfm/services/rfmJobService";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession(req);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
  }

  const result = await scheduleNightlyRfm();
  return NextResponse.json({ message: "تم إعداد الجدولة الليلية لـ RFM", result });
}
