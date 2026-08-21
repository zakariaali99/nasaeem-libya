import { NextRequest, NextResponse } from "next/server";
import { extractIpFromHeaders, getGeoInfo, isPublicIp } from "@/modules/geo/geoService";

export async function GET(req: NextRequest) {
  const headers = req.headers;
  // Allow manual override headers if present (useful for tests / proxies)
  const overrideCountry = headers.get("x-country");
  const overrideCity = headers.get("x-city");
  const overrideRegion = headers.get("x-region");

  if (overrideCountry || overrideCity || overrideRegion) {
    return NextResponse.json({
      country: overrideCountry,
      city: overrideCity,
      region: overrideRegion,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  let ip = extractIpFromHeaders(headers);

  // NextRequest.ip might be available depending on runtime
  if (!ip) {
    const direct = (req as any).ip;
    if (direct && isPublicIp(direct)) ip = direct;
  }

  if (!ip) {
    return NextResponse.json({
      country: null, city: null, region: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }

  const location = await getGeoInfo(ip);
  return NextResponse.json(location);
}
