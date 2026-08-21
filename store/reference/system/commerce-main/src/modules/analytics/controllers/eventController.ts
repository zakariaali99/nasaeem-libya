import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ingestEvents } from "../services/analyticsService";
import { EventPayloadSchema } from "../types/eventTypes";
import { auth } from "@/lib/auth";
import { getGeoInfo } from "@/modules/geo/geoService";

export async function postEvent(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ message: "البيانات غير صالحة" }, { status: 400 });
  }

  const session = await auth.api.getSession(req).catch((err) => {
    console.warn("تعذر قراءة الجلسة أثناء تسجيل الحدث", err);
    return null;
  });

  const userId = session?.user?.id ?? null;

  const headers = req.headers;
  const forwardedFor = headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headers.get("x-real-ip") || undefined;
  const userAgent = headers.get("user-agent") || undefined;

  let geoData = {};
  if (ip) {
    const geo = await getGeoInfo(ip);
    geoData = {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone,
    };
  }

  const rawEvents = Array.isArray(body) ? body : [body];
  const validPayloads = [];

  for (const rawEvent of rawEvents) {
    const mergedPayload = {
      ...(rawEvent || {}),
      properties: {
        ...geoData,
        ...((rawEvent as any)?.properties || {}),
      },
      context: {
        userAgent,
        ip,
        ...((rawEvent as any)?.context || {}),
      },
    };

    try {
      // Validate early to return clear Arabic errors
      EventPayloadSchema.parse(mergedPayload);
      validPayloads.push(mergedPayload as any);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { message: "البيانات غير صالحة", errors: error.issues },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "حدث خطأ أثناء فحص البيانات" },
        { status: 500 }
      );
    }
  }

  try {
    const results = await ingestEvents(validPayloads, userId);
    return NextResponse.json(
      { message: "تم تسجيل الحدث", data: Array.isArray(body) ? results : results[0] },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("خطأ أثناء تسجيل الحدث:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء تسجيل الحدث" },
      { status: 500 }
    );
  }
}
