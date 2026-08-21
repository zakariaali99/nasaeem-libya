"use client";

import { EventPayloadInput } from "../types/eventTypes";

const STORAGE_KEY = "wave_anonymous_id";
const COOKIE_NAME = "wave_anonymous_id";

function fallbackRandomId() {
  return `anon_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function ensureAnonymousId(): string {
  if (typeof window === "undefined") return fallbackRandomId();

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackRandomId();
    localStorage.setItem(STORAGE_KEY, id);
  }

  // Keep a cookie so the server can also read it if needed later
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=${id};path=/;max-age=${maxAge};SameSite=Lax`;

  return id;
}

export function getAnonymousId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY) || null;
}

let eventQueue: EventPayloadInput[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

function flushAnalyticsQueue() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  if (eventQueue.length === 0) return;

  const payload = [...eventQueue];
  eventQueue = [];

  try {
    fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((err) => {
      console.warn("تعذر إرسال حدث التتبع", err);
    });
  } catch (err) {
    console.warn("تعذر إرسال حدث التتبع", err);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushAnalyticsQueue();
    }
  });
}

export function trackEvent(eventName: string, properties: Record<string, any> = {}, context: Record<string, any> = {}) {
  const anonymousId = ensureAnonymousId();
  const location = getLocationInfo();
  const payload: EventPayloadInput = {
    anonymousId,
    eventName,
    eventType: "custom",
    properties: { ...location, ...properties },
    context: {
      url: typeof window !== "undefined" ? window.location.href : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      ...context,
    },
  };

  eventQueue.push(payload);

  if (flushTimeout === null) {
    flushTimeout = setTimeout(flushAnalyticsQueue, 1000);
  }
}

export function trackPageView(additional?: Record<string, any>) {
  const device = getDeviceInfo();
  return trackEvent("page_view", { ...device, ...additional });
}

export function trackProductView(productId: string, additional?: Record<string, any>) {
  const device = getDeviceInfo();
  return trackEvent("product_view", { productId, ...device, ...additional });
}

export function trackScrollDepth(depth: number, context: Record<string, any> = {}) {
  return trackEvent("scroll_depth", { depth }, context);
}

export function trackCampaign(campaign: Record<string, any>) {
  return trackEvent("campaign", campaign);
}

export function trackSearch(query: string, metadata: Record<string, any> = {}) {
  return trackEvent("search", { query, ...metadata });
}

export function trackSearchNoResults(query: string, metadata: Record<string, any> = {}) {
  return trackEvent("search_no_results", { query, ...metadata });
}

export function trackSearchSelect(query: string, productId: string, metadata: Record<string, any> = {}) {
  return trackEvent("search_select", { query, productId, ...metadata });
}

export function trackBrowse(params: Record<string, any>) {
  return trackEvent("browse", params);
}

export function trackProductEngagement(action: string, payload: Record<string, any> = {}) {
  return trackEvent("product_engagement", { action, ...payload });
}

export function trackCheckoutRecovery(action: string, payload: Record<string, any> = {}) {
  return trackEvent("checkout_recovery", { action, ...payload });
}

export function trackFilterSort(action: string, payload: Record<string, any> = {}) {
  return trackEvent("filter_sort_usage", { action, ...payload });
}

export const analyticsClient = {
  ensureAnonymousId,
  getAnonymousId,
  trackEvent,
  trackPageView,
  trackProductView,
  trackScrollDepth,
  trackCampaign,
  trackSearch,
  trackSearchNoResults,
  trackSearchSelect,
  trackBrowse,
  trackProductEngagement,
  trackCheckoutRecovery,
  trackFilterSort,
};

function getDeviceInfo() {
  if (typeof navigator === "undefined") return {} as Record<string, string | undefined>;

  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";
  const brands = (navigator as any).userAgentData?.brands?.map((b: any) => b.brand).join(", ");

  let deviceType: string | undefined = "desktop";
  let deviceName: string | undefined;
  if (/iphone/.test(ua)) {
    deviceType = "mobile";
    deviceName = "iPhone";
  } else if (/ipad/.test(ua)) {
    deviceType = "tablet";
    deviceName = "iPad";
  } else if (/android/.test(ua)) {
    deviceType = /mobile/.test(ua) ? "mobile" : "tablet";
    deviceName = "Android";
  } else if (/macintosh|mac os x/.test(ua)) {
    deviceType = "desktop";
    deviceName = "Mac";
  } else if (/windows/.test(ua)) {
    deviceType = "desktop";
    deviceName = "Windows PC";
  }

  const os = /windows/.test(ua)
    ? "Windows"
    : /mac/.test(ua)
      ? "macOS"
      : /android/.test(ua)
        ? "Android"
        : /iphone|ipad|ipod/.test(ua)
          ? "iOS"
          : undefined;

  const browser = /edg/.test(ua)
    ? "Edge"
    : /chrome|crios/.test(ua)
      ? "Chrome"
      : /safari/.test(ua) && !/chrome|crios/.test(ua)
        ? "Safari"
        : /firefox|fxios/.test(ua)
          ? "Firefox"
          : undefined;

  const screenResolution = typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : undefined;
  const locale = navigator.language;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isTouch = typeof window !== "undefined" && "ontouchstart" in window;

  return {
    device_type: deviceType,
    device_name: deviceName || platform || "غير محدد",
    device_platform: platform || undefined,
    device_brands: brands,
    os,
    browser,
    screen_resolution: screenResolution,
    locale,
    timezone,
    is_touch: isTouch,
    user_agent: navigator.userAgent,
  };
}

let cachedLocation: Record<string, any> | null = null;

function getLocationInfo() {
  if (cachedLocation) return cachedLocation;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = typeof navigator !== "undefined" ? navigator.language : undefined;
  cachedLocation = { timezone: tz, locale };
  return cachedLocation;
}
