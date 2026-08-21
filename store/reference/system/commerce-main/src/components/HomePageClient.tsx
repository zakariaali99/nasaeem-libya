import { Widget } from "@/modules/customization/types/customizationTypes";
import WidgetPreview from "@/components/admin/customization/WidgetPreview";
import { LazyWidgets } from "@/components/LazyWidgets";

interface HomePageClientProps {
  widgets: Widget[];
}

// مكون خادم بسيط لتقليل حجم الجافاسكربت على الصفحة الرئيسية
export default function HomePageClient({ widgets }: HomePageClientProps) {
  if (widgets.length === 0) {
    return (
      <div className="text-center py-16" dir="rtl">
        <p className="text-gray-600">لا توجد عناصر لعرضها حالياً</p>
      </div>
    );
  }

  const firstBatch = widgets.slice(0, 3);
  const lazyWidgets = widgets.slice(3);

  return (
    <div dir="rtl">
      {firstBatch.map((widget, index) => (
        <WidgetPreview key={widget.id} widget={widget} priority={index < 2} />
      ))}

      {lazyWidgets.length > 0 && <LazyWidgets widgets={lazyWidgets} batchSize={2} />}
    </div>
  );
}
