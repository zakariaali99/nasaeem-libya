"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ensureAnonymousId, trackPageView, trackCampaign } from "./analyticsClient";

export default function AnalyticsBootstrap({ trackFirstPageView = true }: { trackFirstPageView?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasTrackedCampaign = useRef(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const id = ensureAnonymousId();
    const doTrackPage = () => trackPageView({ anonymousId: id });

    // Track once per unique pathname (guards React strict-mode double effects)
    if (trackFirstPageView && pathname && lastPath.current !== pathname) {
      lastPath.current = pathname;
      doTrackPage();
    }

    // Campaign attribution (first hit per session)
    if (!hasTrackedCampaign.current && searchParams) {
      const utmSource = searchParams.get("utm_source");
      const utmMedium = searchParams.get("utm_medium");
      const utmCampaign = searchParams.get("utm_campaign");
      const utmTerm = searchParams.get("utm_term");
      const utmContent = searchParams.get("utm_content");
      const ref = typeof document !== "undefined" ? document.referrer : undefined;
      if (utmSource || utmMedium || utmCampaign || utmTerm || utmContent) {
        hasTrackedCampaign.current = true;
        trackCampaign({ utmSource, utmMedium, utmCampaign, utmTerm, utmContent, referrer: ref, path: pathname });
      }
    }
  }, [pathname, searchParams, trackFirstPageView]);

  return null;
}
