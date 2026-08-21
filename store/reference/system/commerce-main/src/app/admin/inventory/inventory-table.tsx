"use client";

import React, { useMemo, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Plus } from "lucide-react";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { InventoryProduct } from "@/modules/inventory/types/inventoryTypes";
import Image from "next/image";

export type InventoryRow = {
    id: string; // unique row id
    productId: string;
    variantId?: string;
    type: 'product' | 'variant' | 'header';
    title: string;
    sku: string | null;
    price: number | null;
    stock: number | null;
    reservedStock: number | null;
    imageUrl?: string | null;
    isActive: boolean;
};

interface InventoryTableProps {
    data: InventoryProduct[];
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    initialSearch?: string;
    onSearchChange?: (value: string) => void;
    onAdjustStock: (row: InventoryRow) => void;
}

export function InventoryTable({
    data,
    page,
    totalPages,
    total,
    pageSize,
    onPageChange,
    onPageSizeChange,
    initialSearch,
    onSearchChange,
    onAdjustStock,
}: InventoryTableProps) {
    const [search, setSearch] = useState(initialSearch ?? "");

    // Flatten data for display
    const rows = useMemo(() => {
        const flat: InventoryRow[] = [];
        data.forEach(p => {
            if (!p.hasVariants) {
                flat.push({
                    id: `product_${p.id}`,
                    productId: p.id,
                    type: 'product',
                    title: p.name,
                    sku: p.sku,
                    price: p.price,
                    stock: p.stock,
                    reservedStock: p.reservedStock,
                    imageUrl: p.imageUrl,
                    isActive: p.isActive,
                });
            } else {
                const totalStock = p.variants.reduce((acc, v) => acc + (v.inventoryQuantity ?? 0), 0);
                const totalReserved = p.variants.reduce((acc, v) => acc + (v.reservedStock ?? 0), 0);

                // Header row for product with variants
                flat.push({
                    id: `header_${p.id}`,
                    productId: p.id,
                    type: 'header',
                    title: p.name,
                    sku: p.sku,
                    price: p.price,
                    stock: totalStock, // aggregate stock
                    reservedStock: totalReserved,
                    imageUrl: p.imageUrl,
                    isActive: p.isActive,
                });

                // Variant rows
                p.variants.forEach(v => {
                    flat.push({
                        id: `variant_${v.id}`,
                        productId: p.id,
                        variantId: v.id,
                        type: 'variant',
                        title: `${p.name} - ${v.title || 'بدون اسم'}`,
                        sku: v.sku,
                        price: v.price,
                        stock: v.inventoryQuantity,
                        reservedStock: v.reservedStock,
                        imageUrl: v.imageUrl || p.imageUrl,
                        isActive: v.isActive,
                    });
                });
            }
        });
        return flat;
    }, [data]);

    React.useEffect(() => {
        if (onSearchChange) onSearchChange(search);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const safeTotalPages = Math.max(1, totalPages || 0);
    const canPrev = page > 1;
    const canNext = page < safeTotalPages;

    const formatCurrency = (val: number | null) => {
        if (val === null) return "-";
        return new Intl.NumberFormat("ar-LY", {
            style: "currency",
            currency: "LYD",
            minimumFractionDigits: 0,
        }).format(val);
    };

    return (
        <div dir="rtl">
            <div className="flex items-center py-4">
                <Input
                    placeholder="ابحث باسم المنتج أو رمز التخزين (SKU)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
            </div>
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right w-16">صورة</TableHead>
                            <TableHead className="text-right">المنتج</TableHead>
                            <TableHead className="text-right">رمز التخزين (SKU)</TableHead>
                            <TableHead className="text-right">السعر</TableHead>
                            <TableHead className="text-right">المتاح</TableHead>
                            <TableHead className="text-right">قيد التوصيل</TableHead>
                            <TableHead className="text-right">الكل</TableHead>
                            <TableHead className="text-right w-32">إجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((row) => {
                                const isHeader = row.type === 'header';
                                const isVariant = row.type === 'variant';

                                return (
                                    <TableRow
                                        key={row.id}
                                        className={isHeader ? "bg-muted/50 font-medium" : "hover:bg-muted/30"}
                                    >
                                        <TableCell>
                                            <div className={`flex items-center justify-center w-10 h-10 rounded-md bg-secondary/50 overflow-hidden ${isVariant ? 'mr-6 scale-90' : ''}`}>
                                                {row.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={row.imageUrl} alt={row.title} className="object-cover w-full h-full" />
                                                ) : (
                                                    <Package className="w-5 h-5 text-muted-foreground" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`text-right ${isVariant ? 'pr-10 text-muted-foreground' : ''}`}>
                                            {isVariant && <span className="text-muted text-lg leading-none align-middle ml-2">↳</span>}
                                            {row.title}
                                            {!row.isActive && <span className="mr-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">غير نشط</span>}
                                        </TableCell>
                                        <TableCell className="text-right" dir="ltr">
                                            <span className="text-left w-full block">{row.sku || "-"}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isHeader ? "-" : formatCurrency(row.price)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-green-600">
                                            {row.stock}
                                        </TableCell>
                                        <TableCell className="text-right text-orange-600">
                                            {row.reservedStock}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-blue-600">
                                            {(row.stock ?? 0) + (row.reservedStock ?? 0)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!isHeader && (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    onClick={() => onAdjustStock(row)}
                                                    className="h-8 gap-1"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    <span>تعديل الكمية</span>
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    لا توجد منتجات مطابقة.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4">
                <div className="text-sm text-muted-foreground">
                    إجمالي المنتجات: {total.toLocaleString("ar-LY")} — صفحة {page} من {totalPages}
                </div>
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (canPrev) onPageChange(page - 1);
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
                                            onPageChange(p);
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
                                    if (canNext) onPageChange(page + 1);
                                }}
                                aria-disabled={!canNext}
                                className={!canNext ? "pointer-events-none opacity-50" : undefined}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>

            {onPageSizeChange && (
                <div className="flex items-center justify-end gap-2 pb-4">
                    <label htmlFor="pageSize" className="text-sm text-muted-foreground">
                        عناصر في الصفحة:
                    </label>
                    <select
                        id="pageSize"
                        className="border rounded-md p-2 text-sm bg-background"
                        value={pageSize}
                        onChange={(e) => onPageSizeChange?.(parseInt(e.target.value, 10))}
                    >
                        {[10, 20, 50].map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}
