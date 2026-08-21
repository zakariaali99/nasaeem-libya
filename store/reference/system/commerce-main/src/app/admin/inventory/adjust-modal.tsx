"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventoryRow } from "./inventory-table";

interface AdjustModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    row: InventoryRow;
    onSuccess: () => void;
}

export function AdjustModal({ open, onOpenChange, row, onSuccess }: AdjustModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [quantityInput, setQuantityInput] = useState<string>("1");
    const [operation, setOperation] = useState<'add' | 'subtract'>('add');
    const [type, setType] = useState<string>("purchase");
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Reset when row changes
    React.useEffect(() => {
        setQuantityInput("1");
        setOperation('add');
        setType("purchase");
        setReference("");
        setNotes("");
        setError(null);
    }, [row]);

    const handleSave = async () => {
        try {
            setError(null);
            const qty = parseInt(quantityInput, 10);
            if (isNaN(qty) || qty <= 0) {
                throw new Error("يجب أن تكون الكمية رقماً صحيحاً موجباً");
            }

            const quantityChange = operation === 'add' ? qty : -qty;

            // Protect against negative total stock if applying adjustment
            if (row.stock !== null && row.stock + quantityChange < 0) {
                throw new Error("لا يمكن أن يكون رصيد المخزون بالسالب");
            }

            setIsLoading(true);

            const res = await fetch('/api/admin/inventory/adjust', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: row.productId,
                    variantId: row.variantId,
                    quantityChange,
                    type,
                    reference: reference || undefined,
                    notes: notes || undefined
                }),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => null);
                throw new Error(errJson?.message || "فشل تحديث المخزون");
            }

            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message || "حدث خطأ غير متوقع");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تعديل المخزون للمنتج</DialogTitle>
                    <DialogDescription>
                        {row.title}
                        {row.sku && ` (SKU: ${row.sku})`}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {error && (
                        <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right whitespace-nowrap">الرصيد الحالي:</Label>
                        <div className="col-span-3 font-medium bg-muted px-3 py-1.5 rounded-md inline-block">
                            {row.stock ?? 0}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">العملية</Label>
                        <div className="col-span-3 flex gap-2">
                            <Button
                                type="button"
                                variant={operation === 'add' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => {
                                    setOperation('add');
                                    setType('purchase'); // default to purchase when adding
                                }}
                            >
                                إضافة (+)
                            </Button>
                            <Button
                                type="button"
                                variant={operation === 'subtract' ? 'destructive' : 'outline'}
                                className="flex-1"
                                onClick={() => {
                                    setOperation('subtract');
                                    setType('sale'); // default to sale when subtracting
                                }}
                            >
                                خصم (-)
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">نوع الحركة</Label>
                        <Select value={type} onValueChange={(v) => setType(v)}>
                            <SelectTrigger className="col-span-3" id="type" dir="rtl">
                                <SelectValue placeholder="اختر نوع الحركة" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                {operation === 'add' ? (
                                    <>
                                        <SelectItem value="purchase">شراء توريد جديد</SelectItem>
                                        <SelectItem value="return">مرتجع من مبيعات</SelectItem>
                                        <SelectItem value="adjustment">تسوية (زيادة)</SelectItem>
                                    </>
                                ) : (
                                    <>
                                        <SelectItem value="sale">مبيعات</SelectItem>
                                        <SelectItem value="adjustment">تسوية (عجز/تالف)</SelectItem>
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right">الكمية</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantityInput}
                            onChange={(e) => setQuantityInput(e.target.value)}
                            className="col-span-3"
                            dir="ltr"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="reference" className="text-right whitespace-nowrap">رقم المستند</Label>
                        <Input
                            id="reference"
                            placeholder="اختياري (رقم فاتورة الخ)"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="col-span-3"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="notes" className="text-right pt-2">ملاحظات</Label>
                        <Textarea
                            id="notes"
                            placeholder="ملاحظات اختيارية..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="col-span-3"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4 mt-2">
                        <Label className="text-right whitespace-nowrap">الرصيد المتوقع:</Label>
                        <div className={`col-span-3 font-bold px-3 py-1.5 rounded-md inline-block ${operation === 'add' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                            {(row.stock ?? 0) + (operation === 'add' ? parseInt(quantityInput || "0", 10) : -parseInt(quantityInput || "0", 10))}
                        </div>
                    </div>
                </div>
                <DialogFooter className="mr-auto w-full flex-row gap-2 justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        إلغاء
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={isLoading}>
                        {isLoading ? "جاري الحفظ..." : "حفظ الرصيد"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
