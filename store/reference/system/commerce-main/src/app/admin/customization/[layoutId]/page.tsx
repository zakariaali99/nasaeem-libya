import { Widget } from '@/modules/customization/types/customizationTypes';
import WidgetEditor from '@/components/admin/customization/WidgetEditor';
import { listWidgets, getLayoutById } from '@/modules/customization/services/customizationService';
import { db } from '@/lib/db/drizzle';
import { products, categories, collections } from '@/lib/db/schema';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const getWidgetsForLayout = async (layoutId: string) => {
    try {
        const result = await listWidgets({ limit: 100, layoutId });
        // Serialize to avoid Next.js "Date object" warning on server->client boundary
        return JSON.parse(JSON.stringify(result.data));
    } catch (e) {
        console.error("Failed to fetch widgets:", e);
        return [];
    }
};

const getOptions = async (table: any) => {
    try {
        const data = await db.select({ id: table.id, name: table.name || table.title }).from(table).limit(100);
        return data.map((item: any) => ({ value: item.id, label: item.name }));
    } catch (e) {
        console.error("Failed to fetch options:", e);
        return [];
    }
};

export default async function LayoutEditorPage({ params }: { params: Promise<{ layoutId: string }> }) {
    const { layoutId } = await params;

    // Parallel fetching
    const [layout, widgets, productOptions, categoryOptions, collectionOptions] = await Promise.all([
        getLayoutById(layoutId),
        getWidgetsForLayout(layoutId),
        getOptions(products),
        getOptions(categories),
        getOptions(collections)
    ]);

    if (!layout) {
        return <div className="p-8 text-center" dir="rtl">التخطيط غير موجود. <Link href="/admin/customization" className="text-blue-500">العودة إلى التخطيطات</Link></div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-90px)] md:h-[calc(100vh-128px)] bg-gray-50/50 -mx-4 -mb-36 md:-mb-12 rounded-lg overflow-hidden border border-gray-200" dir="rtl">
            <div className="bg-white border-b border-gray-100 p-4 shrink-0 flex items-center shadow-sm z-10">
                <Link href="/admin/customization" className="text-gray-500 hover:text-gray-800 transition-colors bg-gray-50 hover:bg-gray-100 p-2 rounded-full mr-2">
                    <ArrowRight className="w-5 h-5" />
                </Link>
                <div className="mr-3">
                    <h1 className="text-lg font-bold text-gray-900 leading-none mb-1">تعديل التخطيط: {layout.name}</h1>
                    <p className="text-xs text-gray-500">{layout.isGlobalActive ? 'هذا التخطيط هو النشط حالياً لجميع الزوار' : 'هذا التخطيط كمسودة أو مجدول للتفعيل'}</p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <WidgetEditor
                    layoutId={layoutId}
                    initialWidgets={widgets}
                    productOptions={productOptions}
                    categoryOptions={categoryOptions}
                    collectionOptions={collectionOptions}
                />
            </div>
        </div>
    );
}
