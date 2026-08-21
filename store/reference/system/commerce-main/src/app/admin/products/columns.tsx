"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define a basic type for product data - adjust based on your actual API response
export type Product = {
    id: string;
    name: string;
    slug: string; // Added slug for navigation
    price: number | string; // can be a number or localized string when variants present
    stock?: number; // Consider how to represent stock with variants (may be undefined)
    // Add other relevant fields as needed
};

export const columns: ColumnDef<Product>[] = [
    {
        accessorKey: "name",
        header: "اسم المنتج",
    },
    {
        accessorKey: "price",
        header: "السعر",
        cell: ({ row }) => {
            const value = row.getValue<string | number>("price");
            if (typeof value === 'number') {
                // Format numeric price in Arabic locale
                const formatted = new Intl.NumberFormat("ar-LY", {
                    style: "currency",
                    currency: "LYD",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(value);
                return <div className="text-right font-medium">{formatted}</div>;
            }
            // Already a string (e.g., 'ابتداءً من ...')
            return <div className="text-right font-medium">{value}</div>;
        },
    },
    {
        accessorKey: "stock",
        header: "المخزون",
        cell: ({ row }) => <div className="text-right">{row.getValue("stock")}</div>,
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const product = row.original;
            const router = useRouter();
            const { show } = useToast();
            const [open, setOpen] = React.useState(false);
            const [menuOpen, setMenuOpen] = React.useState(false);
            const [isDeleting, setIsDeleting] = React.useState(false);

            // Stop propagation to prevent row click from triggering
            const handleEdit = (e: React.MouseEvent) => {
                e.stopPropagation();
                const identifier = product.slug || product.id;
                router.push(`/admin/products/${identifier}`);
            };

            const handleDelete = (e: React.MouseEvent) => {
                e.stopPropagation();
                // Close dropdown first to avoid focus/overlay conflicts
                setMenuOpen(false);
                // Open confirmation dialog
                setOpen(true);
            };

            const handleCopySlug = (e: React.MouseEvent) => {
                e.stopPropagation();
                const value = product.slug || '';
                navigator.clipboard.writeText(value).then(() => {
                    show({ title: 'تم النسخ', description: 'تم نسخ الـ Slug', variant: 'success' });
                }).catch(() => {
                    show({ title: 'فشل النسخ', description: 'تعذر نسخ الـ Slug', variant: 'error' });
                });
            };

                        return (
                                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()} // Prevent row click
                        >
                            <span className="sr-only">فتح القائمة</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.stopPropagation();
                                                                navigator.clipboard.writeText(product.id)
                                                                    .then(() => show({ title: 'تم النسخ', description: 'تم نسخ معرف المنتج', variant: 'success' }))
                                                                    .catch(() => show({ title: 'فشل النسخ', description: 'تعذر نسخ معرف المنتج', variant: 'error' }));
                            }}
                        >
                            نسخ معرف المنتج
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCopySlug}>
                            نسخ الـ Slug
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleEdit}>
                            تعديل المنتج
                        </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(e); }}
                            className="text-red-600"
                        >
                            حذف المنتج
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                                        <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle dir="rtl">تأكيد الحذف</DialogTitle>
                                                    <DialogDescription dir="rtl">
                                                        هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذه العملية.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter>
                                                    <Button variant="outline" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>إلغاء</Button>
                                                    <Button variant="destructive" disabled={isDeleting} onClick={(e) => {
                                                        e.stopPropagation();
                                                        // perform delete
                                                        (async () => {
                                                            try {
                                                                // Ensure dropdown stays closed
                                                                setMenuOpen(false);
                                                                setIsDeleting(true);
                                                                const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
                                                                if (!res.ok) {
                                                                    const t = await res.text();
                                                                    throw new Error(t || 'فشل حذف المنتج');
                                                                }
                                                                window.dispatchEvent(new CustomEvent('products:refresh'));
                                                                show({ title: 'تم الحذف', description: 'تم حذف المنتج بنجاح', variant: 'success' });
                                                                setOpen(false);
                                                            } catch (err: any) {
                                                                show({ title: 'حدث خطأ', description: err?.message || 'حدث خطأ أثناء الحذف', variant: 'error' });
                                                            }
                                                            finally {
                                                                setIsDeleting(false);
                                                            }
                                                        })();
                                                    }}>{isDeleting ? (
                                                        <span className="inline-flex items-center gap-2">
                                                            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true"></span>
                                                            جاري الحذف...
                                                        </span>
                                                    ) : (
                                                        'حذف'
                                                    )}</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                </DropdownMenu>
            );
        },
    },
];