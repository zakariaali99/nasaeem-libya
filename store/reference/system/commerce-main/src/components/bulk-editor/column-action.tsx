"use client";

import React from "react";
import type { Table } from "@tanstack/react-table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BulkTableMeta } from "./types.internal";

type Props = {
    columnId: string;
    table: Table<any>;
};

export function ColumnBulkAction({ columnId, table }: Props) {
    const meta = table.options.meta as BulkTableMeta | undefined;
    const [open, setOpen] = React.useState(false);

    const [action, setAction] = React.useState<"set" | "increase" | "decrease" | "percentage">("set");
    const [value, setValue] = React.useState<string>("");
    const [applyTo, setApplyTo] = React.useState<"all" | "selected">("all");

    const hasSelection = meta?.selectedKeys && meta.selectedKeys.size > 0;

    // Reset when opening
    React.useEffect(() => {
        if (open) {
            setValue("");
            setApplyTo(hasSelection ? "selected" : "all");
        }
    }, [open, hasSelection]);

    const handleApply = () => {
        const numVal = Number(value);
        if (!isNaN(numVal) && meta?.applyBulkAction) {
            meta.applyBulkAction(columnId, action, numVal, applyTo);
        }
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground mr-1" title="تعديل جماعي السريع">
                    <Calculator className="h-3.5 w-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3" dir="rtl">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs">العملية</Label>
                        <Select value={action} onValueChange={(v) => setAction(v as any)}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="set">تعيين قيمة ثابتة</SelectItem>
                                <SelectItem value="increase">زيادة بمقدار</SelectItem>
                                <SelectItem value="decrease">نقص بمقدار</SelectItem>
                                <SelectItem value="percentage">زيادة بنسبة مئوية (+%)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">القيمة</Label>
                        <Input
                            type="number"
                            className="h-8 text-sm"
                            placeholder="مثال: 10"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">التطبيق على</Label>
                        <Select value={applyTo} onValueChange={(v) => setApplyTo(v as any)}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">كل الصفوف المرئية</SelectItem>
                                <SelectItem value="selected" disabled={!hasSelection}>الصفوف المحددة فقط</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="w-full h-8 text-sm" onClick={handleApply} disabled={!value}>
                        تطبيق
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
