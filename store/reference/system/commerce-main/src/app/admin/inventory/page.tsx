"use client";

import React, { useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { InventoryTable, InventoryRow } from "./inventory-table";
import { InventoryProduct } from "@/modules/inventory/types/inventoryTypes";
import { AdjustModal } from "./adjust-modal";
import { Button } from "@/components/ui/button";

type PaginatedInventory = {
    data: InventoryProduct[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

async function fetchInventory(params: { page: number; limit: number; search?: string }): Promise<PaginatedInventory> {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page));
    qs.set("limit", String(params.limit));
    if (params.search) qs.set("search", params.search);

    const response = await fetch(`/api/admin/inventory?${qs.toString()}`);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${response.status} - ${errorText}`);
        throw new Error("فشل في جلب المخزون");
    }
    const json = await response.json();
    return json.data;
}

export default function InventoryPage() {
    return (
        <React.Suspense fallback={<div className="p-4 text-center" dir="rtl">جاري التحميل...</div>}>
            <InventoryPageContent />
        </React.Suspense>
    );
}

function InventoryPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialPage = Number(searchParams.get("page") || "1");
    const initialLimit = Number(searchParams.get("limit") || "10");
    const initialQuery = searchParams.get("q") || "";

    const [page, setPage] = useState<number>(isNaN(initialPage) || initialPage < 1 ? 1 : initialPage);
    const [limit, setLimit] = useState<number>(isNaN(initialLimit) || initialLimit < 1 ? 10 : initialLimit);
    const [search, setSearch] = useState<string>(initialQuery);
    const debouncedSearch = useDebounce(search, 400);

    const [adjustModalOpen, setAdjustModalOpen] = useState(false);
    const [adjustRow, setAdjustRow] = useState<InventoryRow | null>(null);

    useEffect(() => {
        const qs = new URLSearchParams();
        if (page > 1) qs.set("page", String(page));
        if (limit !== 10) qs.set("limit", String(limit));
        if (debouncedSearch) qs.set("q", debouncedSearch);
        const href = `/admin/inventory?${qs.toString()}`;
        router.replace(href);
    }, [page, limit, debouncedSearch, router]);

    const { data: paginated, isLoading, error, refetch } = useQuery<PaginatedInventory, Error>({
        queryKey: ["inventory", page, limit, debouncedSearch],
        queryFn: () => fetchInventory({ page, limit, search: debouncedSearch || undefined }),
        placeholderData: keepPreviousData,
    });

    const clampPage = React.useCallback(
        (next: number) => {
            const maxPage = paginated?.totalPages && paginated.totalPages > 0 ? paginated.totalPages : Number.POSITIVE_INFINITY;
            const normalized = Math.max(1, Math.min(Math.trunc(next), maxPage));
            setPage((prev) => (prev === normalized ? prev : normalized));
        },
        [paginated?.totalPages]
    );

    useEffect(() => {
        if (!paginated?.totalPages) return;
        const maxPage = Math.max(1, paginated.totalPages);
        if (page > maxPage) setPage(maxPage);
        else if (page < 1) setPage(1);
    }, [paginated?.totalPages, page]);

    const handleAdjustInventory = (row: InventoryRow) => {
        setAdjustRow(row);
        setAdjustModalOpen(true);
    };

    if (isLoading) {
        return <div className="p-4 text-center" dir="rtl">جاري تحميل المخزون...</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-600" dir="rtl">خطأ: {error.message}</div>;
    }

    return (
        <div className="container mx-auto py-10 px-4" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">إدارة المخزون</h1>
                <Button variant="outline" onClick={() => router.push('/admin/inventory/logs')}>
                    سجل الحركات (الشحنات والطلبات)
                </Button>
            </div>

            <InventoryTable
                data={paginated?.data ?? []}
                page={page}
                totalPages={paginated?.totalPages ?? 1}
                total={paginated?.total ?? 0}
                pageSize={limit}
                onPageChange={clampPage}
                onPageSizeChange={(l: number) => { setPage(1); setLimit(l); }}
                initialSearch={initialQuery}
                onSearchChange={(q: string) => { setPage(1); setSearch(q); }}
                onAdjustStock={handleAdjustInventory}
            />

            {adjustRow && (
                <AdjustModal
                    open={adjustModalOpen}
                    onOpenChange={setAdjustModalOpen}
                    row={adjustRow}
                    onSuccess={() => refetch()}
                />
            )}
        </div>
    );
}
