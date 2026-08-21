"use client";

import { useEffect, useRef } from "react";
import { trackScrollDepth } from "./analyticsClient";

const DEPTHS = [25, 50, 75, 100];

export default function ScrollTracker() {
  const reached = useRef<Set<number>>(new Set());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timeoutId !== null) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (typeof document === "undefined" || typeof window === "undefined") return;
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;
        const percent = Math.min(100, Math.round((scrollTop / docHeight) * 100));
        DEPTHS.forEach((d) => {
          if (percent >= d && !reached.current.has(d)) {
            reached.current.add(d);
            trackScrollDepth(d, { path: window.location.pathname });
          }
        });
      }, 200);
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => {
      window.removeEventListener("scroll", handler);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
