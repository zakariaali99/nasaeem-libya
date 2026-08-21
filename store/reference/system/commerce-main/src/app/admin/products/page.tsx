"use client"; // Required for hooks like useQuery and useState

import React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { columns, Product } from './columns'; // Adjust the import path if needed
import { DataTable } from './data-table'; // Adjust the import path if needed
import { Button } from '@/components/ui/button'; // Adjust the import path if needed
import { useDebounce } from '@/hooks/use-debounce';
import { BulkEditor } from '@/components/bulk-editor/bulk-editor';
import type { BulkEditorColumn } from '@/components/bulk-editor/types';
import { z } from 'zod';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

type PaginatedProducts = {
    data: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const productBulkSchema = z.object({
    rows: z.array(
        z.object({
            id: z.string().optional(),
            name: z.string().min(1, 'الاسم مطلوب'),
            price: z.preprocess((val) => {
                const n = Number(val);
                return Number.isFinite(n) ? n : 0;
            }, z.number().nonnegative('السعر لا يمكن أن يكون سالباً')),
            stock: z.preprocess((val) => {
                if (val === '' || val === null || val === undefined) return 0;
                const n = Number(val);
                return Number.isFinite(n) ? n : 0;
            }, z.number().nonnegative('المخزون لا يمكن أن يكون سالباً')),
        })
    ),
});

type BulkRow = z.infer<typeof productBulkSchema>['rows'][number];

const bulkColumns: BulkEditorColumn<BulkRow>[] = [
    {
        id: 'name',
        header: 'اسم المنتج',
        path: 'name',
        placeholder: 'اسم المنتج',
        meta: { size: 300, align: 'right' }
    },
    {
        id: 'price',
        header: 'السعر',
        path: 'price',
        inputType: 'number',
        placeholder: '0',
        parse: (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        },
        meta: { size: 120, align: 'left' }
    },
    {
        id: 'stock',
        header: 'المخزون',
        path: 'stock',
        inputType: 'number',
        placeholder: '0',
        parse: (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        },
        meta: { size: 100, align: 'left' }
    },
];

// Fetch with pagination/search
async function fetchProducts(params: { page: number; limit: number; search?: string }): Promise<PaginatedProducts> {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page));
    qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    const response = await fetch(`/api/products?${qs.toString()}`);
    if (!response.ok) {
        // Log the response status and text for more details on failure
        const errorText = await response.text();
        console.error(`API Error: ${response.status} - ${errorText}`);
        throw new Error('فشل في جلب المنتجات');
    }
    const json = await response.json();
    return json.data; // API wraps in { message, data }
}

function ProductsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialPage = Number(searchParams.get('page') || '1');
    const initialLimit = Number(searchParams.get('limit') || '10');
    const initialQuery = searchParams.get('q') || '';

    const [page, setPage] = React.useState<number>(isNaN(initialPage) || initialPage < 1 ? 1 : initialPage);
    const [limit, setLimit] = React.useState<number>(isNaN(initialLimit) || initialLimit < 1 ? 10 : initialLimit);
    const [search, setSearch] = React.useState<string>(initialQuery);
    const debouncedSearch = useDebounce(search, 400);
    const [open, setOpen] = React.useState(false);

    // Keep URL in sync (RTL: use q param for search)
    React.useEffect(() => {
        const qs = new URLSearchParams();
        if (page > 1) qs.set('page', String(page));
        if (limit !== 10) qs.set('limit', String(limit));
        if (debouncedSearch) qs.set('q', debouncedSearch);
        const href = `/admin/products?${qs.toString()}`;
        router.replace(href);
    }, [page, limit, debouncedSearch, router]);

    const { data: paginated, isLoading, error, refetch } = useQuery<PaginatedProducts, Error>({
        queryKey: ['products', page, limit, debouncedSearch],
        queryFn: () => fetchProducts({ page, limit, search: debouncedSearch || undefined }),
        placeholderData: keepPreviousData, // prevents snapping back while new page loads
    });

    const bulkDefaults = React.useMemo(() => {
        return {
            rows: (paginated?.data ?? []).map((p) => ({
                id: p.id,
                name: p.name ?? '',
                price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
                stock: typeof p.stock === 'number' ? p.stock : Number(p.stock) || 0,
            })),
        } as z.infer<typeof productBulkSchema>;
    }, [paginated?.data]);

    const bulkEditorKey = React.useMemo(() => `${page}-${debouncedSearch}-${limit}`, [page, debouncedSearch, limit]);

    const handleBulkSubmit = React.useCallback(async ({ dirtyRows }: { dirtyRows: Array<{ rowIndex: number; id?: string; changes: Record<string, any> }> }) => {
        if (!dirtyRows.length) return;
        try {
            // Map payload to backend expected format: Array<{ id: string, data: UpdateProductInput }>
            const payload = dirtyRows.map(row => {
                if (!row.id) throw new Error("Row ID missing for update");
                return {
                    id: row.id,
                    data: row.changes
                };
            });

            const res = await fetch('/api/products/bulk', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const text = await res.text();
                // Try to parse JSON error message if possible
                try {
                    const json = JSON.parse(text);
                    throw new Error(json.message || 'فشل حفظ التغييرات');
                } catch (e) {
                    throw new Error(text || 'فشل حفظ التغييرات');
                }
            }
            const json = await res.json();
            // Show success message (optional, could use toast)
            // alert(`تم تحديث ${json.count} منتج بنجاح`); 

            await refetch();
            window.dispatchEvent(new CustomEvent('products:refresh'));
        } catch (err: any) {
            console.error(err);
            alert(err?.message || 'فشل حفظ التغييرات');
            throw err;
        }
    }, [refetch]);

    const clampPage = React.useCallback(
        (next: number) => {
            const maxPage = paginated?.totalPages && paginated.totalPages > 0 ? paginated.totalPages : Number.POSITIVE_INFINITY;
            const normalized = Math.max(1, Math.min(Math.trunc(next), maxPage));
            setPage((prev) => (prev === normalized ? prev : normalized));
        },
        [paginated?.totalPages]
    );

    // Clamp page to available totalPages to handle out-of-range navigation (e.g., after filtering)
    React.useEffect(() => {
        if (!paginated?.totalPages) return;
        const maxPage = Math.max(1, paginated.totalPages);
        if (page > maxPage) {
            setPage(maxPage);
        } else if (page < 1) {
            setPage(1);
        }
    }, [paginated?.totalPages, page]);

    // Listen for external refresh events from actions (e.g., delete)
    React.useEffect(() => {
        const handler = () => {
            // Try to keep current page and filters, just refetch
            refetch();
        };
        window.addEventListener('products:refresh', handler);
        return () => window.removeEventListener('products:refresh', handler);
    }, [refetch]);

    // Handle loading state
    if (isLoading) {
        return <div className="p-4 text-center" dir="rtl">جاري تحميل المنتجات...</div>;
    }

    // Handle error state
    if (error) {
        return <div className="p-4 text-center text-red-600" dir="rtl">خطأ: {error.message}</div>;
    }

    const handleAddNewProduct = () => {
        router.push('/admin/products/new'); // Navigate to the new product page
    };

    return (
        <div className="container mx-auto py-10 px-4" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">إدارة المنتجات</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setOpen(true)}>المحرر المجمع</Button>
                    <Button onClick={handleAddNewProduct}>إضافة منتج جديد</Button>
                </div>
            </div>
            <DataTable
                columns={columns}
                data={paginated?.data ?? []}
                page={page}
                totalPages={paginated?.totalPages ?? 1}
                total={paginated?.total ?? 0}
                pageSize={paginated?.limit ?? limit}
                onPageChange={clampPage}
                onPageSizeChange={(l) => {
                    setPage(1); // reset to first page when page size changes
                    setLimit(l);
                }}
                initialSearch={initialQuery}
                onSearchChange={(q) => {
                    setPage(1); // reset to first page on new search
                    setSearch(q);
                }}
            />

            {/* Sheet for bulk editor */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="bottom" className="h-[95vh] rounded-t-2xl flex flex-col p-4 sm:p-6 bg-background data-[state=open]:duration-400">
                    <SheetHeader className="pb-2 shrink-0 text-right space-y-1">
                        <SheetTitle dir="rtl" className="text-2xl">المحرر المجمع</SheetTitle>
                        <SheetDescription dir="rtl" className="text-base text-muted-foreground mr-1">
                            حرر حقول المنتجات دفعة واحدة ثم حفظ فقط الحقول المعدلة.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-hidden mt-2 h-full rounded-md">
                        <BulkEditor
                            key={bulkEditorKey}
                            schema={productBulkSchema}
                            defaultValues={bulkDefaults}
                            columns={bulkColumns}
                            title="المنتجات المعروضة"
                            description="يتم حفظ الحقول التي تغيرت فقط، مع دعم السحب للتعبئة والتنقل بالأسهم."
                            onSubmit={async (payload) => {
                                await handleBulkSubmit(payload as any);
                                setOpen(false);
                            }}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

// Export the content component directly
// Export with Suspense to avoid SSR bailout error when using useSearchParams
export default function ProductsPage() {
    return (
        <React.Suspense fallback={<div className="p-4 text-center" dir="rtl">جاري التحميل...</div>}>
            <ProductsPageContent />
        </React.Suspense>
    );
}