"use client";

import React, { useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

export default function InventoryLogsPage() {
    return (
        <React.Suspense fallback={<div className="p-4 text-center" dir="rtl">جاري التحميل...</div>}>
            <InventoryLogsPageContent />
        </React.Suspense>
    );
}

function InventoryLogsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialPage = Number(searchParams.get("page") || "1");
    const initialLimit = Number(searchParams.get("limit") || "10");

    const [page, setPage] = useState<number>(isNaN(initialPage) || initialPage < 1 ? 1 : initialPage);
    const [limit, setLimit] = useState<number>(isNaN(initialLimit) || initialLimit < 1 ? 10 : initialLimit);

    useEffect(() => {
        const qs = new URLSearchParams();
        if (page > 1) qs.set("page", String(page));
        if (limit !== 10) qs.set("limit", String(limit));
        const href = `/admin/inventory/logs?${qs.toString()}`;
        router.replace(href);
    }, [page, limit, router]);

    const { data: paginated, isLoading, error } = useQuery({
        queryKey: ["inventory-logs", page, limit],
        queryFn: async () => {
            const res = await fetch(`/api/admin/inventory/logs?page=${page}&limit=${limit}`);
            if (!res.ok) throw new Error("فشل في جلب السجل");
            return (await res.json()).data;
        },
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

    const safeTotalPages = Math.max(1, paginated?.totalPages || 0);
    const canPrev = page > 1;
    const canNext = page < safeTotalPages;

    const translateType = (type: string) => {
        switch (type) {
            case 'purchase': return 'شراء توريد جديد';
            case 'sale': return 'مبيعات';
            case 'adjustment': return 'تسوية';
            case 'return': return 'مرتجع طرد';
            default: return type;
        }
    };

    if (isLoading) {
        return <div className="p-4 text-center" dir="rtl">جاري جلب السجل...</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-600" dir="rtl">خطأ: {error.message}</div>;
    }

    return (
        <div className="container mx-auto py-10 px-4" dir="rtl">
            <div className="flex items-center mb-6 gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/admin/inventory')}>
                    <ChevronRight className="h-6 w-6" />
                </Button>
                <h1 className="text-3xl font-bold">سجل الحركات والشحنات</h1>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">التاريخ</TableHead>
                            <TableHead className="text-right">المنتج / الصنف</TableHead>
                            <TableHead className="text-right">نوع الحركة</TableHead>
                            <TableHead className="text-right">الكمية المهلكة/المضافة</TableHead>
                            <TableHead className="text-right">بواسطة</TableHead>
                            <TableHead className="text-right">ملاحظات / مرجع</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated?.data?.length > 0 ? (
                            paginated.data.map((row: any) => (
                                <TableRow key={row.id}>
                                    <TableCell className="text-right">
                                        {new Date(row.createdAt).toLocaleString("ar-LY")}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {row.productName || "منتج محذوف"}
                                        {row.variantTitle && <span className="text-muted-foreground mr-1">({row.variantTitle})</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {translateType(row.type)}
                                    </TableCell>
                                    <TableCell className="text-right font-bold" dir="ltr">
                                        <div className={`inline-block px-2 py-1 rounded ${row.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {row.adminName || row.createdBy || "النظام"}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground max-w-xs truncate">
                                        {row.reference && <div className="text-xs">مرجع: {row.reference}</div>}
                                        {row.notes}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    لا يوجد حركات مسجلة.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4">
                <div className="text-sm text-muted-foreground">
                    إجمالي الحركات: {paginated?.total?.toLocaleString("ar-LY")} — صفحة {page} من {safeTotalPages}
                </div>
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (canPrev) clampPage(page - 1);
                                }}
                                aria-disabled={!canPrev}
                                className={!canPrev ? "pointer-events-none opacity-50" : undefined}
                            />
                        </PaginationItem>
                        {(() => {
                            const start = Math.max(1, page - 2);
                            const end = Math.min(safeTotalPages, page + 2);
                            return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
                                <PaginationItem key={p}>
                                    <PaginationLink
                                        href="#"
                                        isActive={p === page}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            clampPage(p);
                                        }}
                                    >
                                        {p}
                                    </PaginationLink>
                                </PaginationItem>
                            ));
                        })()}
                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (canNext) clampPage(page + 1);
                                }}
                                aria-disabled={!canNext}
                                className={!canNext ? "pointer-events-none opacity-50" : undefined}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>

            <div className="flex items-center justify-end gap-2 pb-4">
                <label htmlFor="pageSize" className="text-sm text-muted-foreground">
                    عناصر في الصفحة:
                </label>
                <select
                    id="pageSize"
                    className="border rounded-md p-2 text-sm bg-background"
                    value={limit}
                    onChange={(e) => {
                        setPage(1);
                        setLimit(parseInt(e.target.value, 10));
                    }}
                >
                    {[10, 20, 50].map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
