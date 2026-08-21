"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Keeps the Better Auth session fresh but avoids aggressive refreshes
export function useSessionSync() {
  const router = useRouter();
  const pathname = usePathname();
  const sessionState = authClient.useSession();
  const { data: session, refetch } = sessionState;
  const prevAuthed = useRef<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFocus = () => refetch?.();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refetch?.();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refetch]);

  // Only refetch on path change, don't force refresh
  useEffect(() => {
    refetch?.();
  }, [pathname, refetch]);

  useEffect(() => {
    // Only track transition from unauthenticated -> authenticated
    // We don't want to refresh on every single update or initial load
    const current = Boolean(session?.user);

    if (prevAuthed.current === null) {
      prevAuthed.current = current;
      return;
    }

    // Only refresh if we went from NOT logged in to LOGGED in
    // This handles the case where a user logs in and we need to update server components
    if (!prevAuthed.current && current) {
      prevAuthed.current = current;
      router.refresh();
    } else if (prevAuthed.current !== current) {
      // Just update the ref for other state changes (like logout) without forcing a hard refresh loop
      prevAuthed.current = current;
    }
  }, [session, router]);

  return sessionState;
}
