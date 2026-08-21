import { NextRequest } from "next/server";
import redisClient from "@/modules/cache/redisClient";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h per IP
const RATE_LIMIT_KEY = "geo:ipapi:blocked";

export interface GeoInfo {
    country: string | null;
    countryCode: string | null;
    city: string | null;
    region: string | null;
    timezone: string;
    latitude: number | null;
    longitude: number | null;
    zip: string | null;
    ip: string | null;
    isp: string | null;
    org: string | null;
    rateLimited?: boolean;
}

export function extractIpFromHeaders(headers: Headers): string | null {
    const xfwd = headers.get("x-forwarded-for");
    if (xfwd) {
        const first = xfwd.split(",")[0].trim();
        if (first && isPublicIp(first)) return first;
    }
    const real = headers.get("x-real-ip");
    if (real && isPublicIp(real)) return real;
    const cf = headers.get("cf-connecting-ip");
    if (cf && isPublicIp(cf)) return cf;
    return null;
}

export function isPublicIp(ip: string): boolean {
    if (!ip) return false;
    const trimmed = ip.trim();
    if (trimmed === "::1" || trimmed === "127.0.0.1" || trimmed === "localhost") return false;
    if (trimmed.startsWith("10.") || trimmed.startsWith("192.168.") || trimmed.startsWith("172.")) {
        return false;
    }
    return true;
}

export async function getGeoInfo(ip: string): Promise<GeoInfo> {
    const cacheKey = `geo:${ip}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    const blocked = await redisClient.get(RATE_LIMIT_KEY);
    if (blocked) {
        return {
            country: null, countryCode: null, city: null, region: null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            latitude: null, longitude: null, zip: null, ip, isp: null, org: null,
            rateLimited: true
        };
    }

    const location = await lookupIp(ip);
    await redisClient.set(cacheKey, JSON.stringify(location), "EX", CACHE_TTL_SECONDS);
    return location;
}

async function lookupIp(ip: string): Promise<GeoInfo> {
    const base = process.env.GEOIP_PROVIDER_URL || "http://ip-api.com";
    const fields = process.env.GEOIP_FIELDS || "status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,query,isp,org";
    const url = `${base}/json/${ip}?fields=${encodeURIComponent(fields)}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        clearTimeout(timeout);

        await handleRateLimitHeaders(res.headers);

        if (!res.ok) throw new Error(`geo provider ${res.status}`);
        const json = await res.json();

        if (json?.status && json.status !== "success") {
            throw new Error(`geo provider message: ${json?.message || "unknown"}`);
        }

        return {
            country: json?.country || null,
            countryCode: json?.countryCode || null,
            city: json?.city || null,
            region: json?.regionName || json?.region || null,
            timezone: json?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            latitude: typeof json?.lat === "number" ? json.lat : null,
            longitude: typeof json?.lon === "number" ? json.lon : null,
            zip: json?.zip || null,
            ip: json?.query || null,
            isp: json?.isp || null,
            org: json?.org || null,
        };
    } catch (err) {
        console.warn("geo lookup failed", err);
        return {
            country: null, countryCode: null, city: null, region: null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            latitude: null, longitude: null, zip: null, ip, isp: null, org: null
        };
    }
}

async function handleRateLimitHeaders(headers: Headers) {
    const remaining = headers.get("X-Rl") || headers.get("x-rl");
    const ttl = headers.get("X-Ttl") || headers.get("x-ttl");
    if (remaining === "0") {
        const seconds = Number(ttl) || 60;
        await redisClient.set(RATE_LIMIT_KEY, "1", "EX", Math.max(1, Math.min(seconds, 3600)));
    }
}
