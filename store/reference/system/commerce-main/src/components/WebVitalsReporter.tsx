"use client";

import { useReportWebVitals } from "next/web-vitals";
import { ensureAnonymousId, trackEvent } from "@/modules/analytics/client/analyticsClient";

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    try {
      ensureAnonymousId();
      const key = metric.name.toLowerCase(); // cls, fid, lcp, inp, ttfb, fcp

      trackEvent("web_vitals", {
        name: metric.name,
        value: metric.value,
        id: metric.id,
        label: (metric as any).label,
        rating: (metric as any).rating,
        delta: (metric as any).delta,
        entries: Array.isArray((metric as any).entries) ? (metric as any).entries.length : undefined,
        [key]: metric.value,
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("تعذر إرسال Web Vitals", error);
      }
    }
  });

  return null;
}
