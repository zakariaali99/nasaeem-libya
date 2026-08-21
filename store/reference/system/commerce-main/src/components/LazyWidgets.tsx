"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WidgetPreview from "@/components/admin/customization/WidgetPreview";
import { Widget } from "@/modules/customization/types/customizationTypes";

interface LazyWidgetsProps {
  widgets: Widget[];
  batchSize?: number;
}

// تحميل كسول للودجات بعد الأولى مع حارس تقاطع وسكلتون ثابت الارتفاع
export function LazyWidgets({ widgets, batchSize = 2 }: LazyWidgetsProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ابدأ مباشرة بدفعة أولى صغيرة حتى يظهر المحتوى سريعاً
  useEffect(() => {
    setVisibleCount(Math.min(batchSize, widgets.length));
  }, [batchSize, widgets.length]);

  // زد عدد العناصر عند اقتراب الحارس من الشاشة
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleCount((prev) => Math.min(widgets.length, prev + batchSize));
          }
        });
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [batchSize, widgets.length]);

  const [visible, remaining] = useMemo(() => {
    const v = widgets.slice(0, visibleCount);
    const r = widgets.length - visibleCount;
    return [v, r];
  }, [visibleCount, widgets]);

  const handleLoadMore = () => setVisibleCount((prev) => Math.min(widgets.length, prev + batchSize));

  return (
    <div dir="rtl">
      {visible.map((widget) => (
        <WidgetPreview key={widget.id} widget={widget} />
      ))}

      {remaining > 0 && (
        <div ref={sentinelRef} className="flex flex-col items-center gap-4 py-4">
          <div className="w-full space-y-3">
            {Array.from({ length: Math.min(batchSize, remaining) }).map((_, idx) => (
              <div
                key={idx}
                className="h-48 w-full animate-pulse rounded-3xl bg-gray-100"
                aria-hidden
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleLoadMore}
            className="rounded-full bg-black text-white px-4 py-2 text-sm font-semibold shadow-sm"
          >
            عرض المزيد
          </button>
        </div>
      )}
    </div>
  );
}
