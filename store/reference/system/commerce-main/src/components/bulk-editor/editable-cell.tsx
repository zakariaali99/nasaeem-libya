"use client";

import React from "react";
import { useController, useFormContext } from "react-hook-form";
import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertCircle } from "lucide-react";
import type { BulkTableMeta } from "./types.internal";
import type { CellCoord } from "./types";

type EditableCellProps = {
    table: Table<any>;
    rowIndex: number;
    columnId: string;
    path: string;
    inputType?: "text" | "number" | "textarea" | "select" | "switch" | "media";
    placeholder?: string;
    options?: { label: string; value: string | number }[];
    parse?: (value: string) => any;
    format?: (value: any) => string;
};

function isBetween(originRow: number | undefined, targetRow: number | undefined, currentRow: number) {
    if (originRow === undefined || targetRow === undefined) return false;
    const [start, end] = originRow < targetRow ? [originRow, targetRow] : [targetRow, originRow];
    return currentRow >= start && currentRow <= end;
}

function EditableCellBase({ table, rowIndex, columnId, path, inputType = "text", placeholder, options, parse, format }: EditableCellProps) {
    const meta = table.options.meta as BulkTableMeta | undefined;
    const coord: CellCoord = React.useMemo(() => ({ rowIndex, columnId }), [rowIndex, columnId]);

    const { control } = useFormContext();
    const { field, fieldState } = useController({ name: path, control });

    const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const isFocused = meta?.focusCell?.columnId === columnId && meta?.focusCell?.rowIndex === rowIndex;
    const isSelected = meta?.selectedKeys?.has?.(`${rowIndex}:${columnId}`);

    const isEditing = meta?.editingCell?.columnId === columnId && meta?.editingCell?.rowIndex === rowIndex;

    // Focus Management
    React.useEffect(() => {
        if (isEditing) {
            // Edit Mode: Focus the input
            requestAnimationFrame(() => {
                const el = inputRef.current;
                if (el) {
                    el.focus();
                    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                        try {
                            // Move cursor to end
                            const len = el.value.length;
                            el.setSelectionRange(len, len);
                        } catch (e) {
                            // Some input types like 'number' or 'email' do not support setSelectionRange natively
                        }
                    }
                }
            });
        } else if (isFocused) {
            // View Mode: Focus the container div
            containerRef.current?.focus();
        }
    }, [isEditing, isFocused]);

    const displayValue = React.useMemo(() => {
        if (!format) return field.value ?? "";
        return format(field.value);
    }, [field.value, format]);

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!meta) return;
        const target = event.currentTarget;
        const caretStart = 'selectionStart' in target ? (target.selectionStart ?? 0) : 0;
        const caretEnd = 'selectionEnd' in target ? (target.selectionEnd ?? caretStart) : caretStart;
        const isTextarea = target instanceof HTMLTextAreaElement;

        if (event.key === "Enter") {
            if (isTextarea && event.shiftKey) return; // Allow Shift+Enter in textarea
            event.preventDefault();
            event.stopPropagation(); // Stop propagation so container doesn't re-trigger edit
            target.blur(); // Blur triggers onBlur -> endEdit
            return;
        }

        if (event.key === "Escape") {
            meta.endEdit();
            return;
        }

        // Navigation from within Input (only if caret is at edge)
        if (event.key === "ArrowLeft") {
            if (caretStart > 0) { event.stopPropagation(); return; }
            event.preventDefault();
            meta.moveFocus("left");
        }
        else if (event.key === "ArrowRight") {
            if (caretEnd < target.value.length) { event.stopPropagation(); return; }
            event.preventDefault();
            meta.moveFocus("right");
        }
        else if (event.key === "ArrowUp") {
            if (isTextarea && target.value.slice(0, caretStart).includes("\n")) { event.stopPropagation(); return; }
            event.preventDefault();
            meta.moveFocus("up");
        }
        else if (event.key === "ArrowDown") {
            if (isTextarea && target.value.slice(caretEnd).includes("\n")) { event.stopPropagation(); return; }
            event.preventDefault();
            meta.moveFocus("down");
        }
    };

    // Handle keys when the Container is focused (View Mode)
    const handleContainerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (isEditing || !meta) return;

        // Prevent default browser scrolling for arrows
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
        }

        if (event.key === "Enter") {
            event.preventDefault();
            meta.beginEdit(coord);
            return;
        }

        if (event.key === "Backspace" || event.key === "Delete") {
            if (inputType === "switch") {
                field.onChange(false);
            } else {
                field.onChange("");
            }
            setTimeout(() => { meta.endEdit() }, 0);
            return;
        }

        // Spacebar toggles switch instantly
        if (event.key === " " && inputType === "switch") {
            event.preventDefault();
            field.onChange(!field.value);
            setTimeout(() => { meta.endEdit() }, 0); // pushes to history
            return;
        }

        // Simple Navigation
        if (event.key === "ArrowUp") meta.moveFocus("up");
        if (event.key === "ArrowDown") meta.moveFocus("down");
        if (event.key === "ArrowLeft") meta.moveFocus("left");
        if (event.key === "ArrowRight") meta.moveFocus("right");
    };

    const hasError = !!fieldState.invalid;

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            role="gridcell"
            data-cell-id={`${rowIndex}:${columnId}`}
            className={cn(
                "relative h-full w-full p-2 outline-none transition-colors",
                // Remove base border-b/border-r as the parent grid handles structure or strict border-collapse
                hasError && "bg-destructive/10 ring-1 ring-inset ring-destructive",
                isFocused && "ring-1 ring-inset ring-primary z-10 bg-accent/20",
                isSelected && !isFocused && "bg-primary/5"
            )}
            onClick={(e) => meta?.handleCellClick(e, coord)}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (inputType !== "media") meta?.beginEdit(coord);
            }}
            onMouseEnter={() => meta?.hoverFill(rowIndex)}
            onKeyDown={handleContainerKeyDown}
            dir="auto"
            title={hasError ? fieldState.error?.message : undefined}
        >
            <div className="flex items-center h-full w-full">
                {isEditing ? (
                    inputType === "textarea" ? (
                        <textarea
                            dir="auto"
                            className="w-full h-full resize-none bg-transparent text-sm outline-none px-1"
                            rows={1}
                            value={field.value ?? ""}
                            placeholder={placeholder}
                            onChange={(e) => field.onChange(parse ? parse(e.target.value) : e.target.value)}
                            onBlur={() => { field.onBlur(); meta?.endEdit(); }}
                            onKeyDown={handleInputKeyDown}
                            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        />
                    ) : inputType === "select" ? (
                        <select
                            dir="auto"
                            className="w-full h-full bg-transparent text-sm outline-none border-0 focus:ring-0 px-1 cursor-pointer"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(parse ? parse(e.target.value) : e.target.value)}
                            onBlur={() => { field.onBlur(); meta?.endEdit(); }}
                            onKeyDown={handleInputKeyDown}
                            ref={inputRef as unknown as React.RefObject<HTMLSelectElement>}
                        >
                            <option value="" disabled hidden>{placeholder ?? "اختر..."}</option>
                            {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    ) : inputType === "switch" ? (
                        <div className="flex w-full h-full items-center px-1">
                            <Switch
                                checked={!!field.value}
                                onCheckedChange={(c) => {
                                    field.onChange(c);
                                    setTimeout(() => meta?.endEdit(), 50);
                                }}
                                onBlur={() => { field.onBlur(); meta?.endEdit(); }}
                                ref={inputRef as any}
                            />
                        </div>
                    ) : (
                        <Input
                            dir="auto"
                            type={inputType}
                            className="h-full w-full border-0 bg-transparent p-0 px-1 text-sm shadow-none focus-visible:ring-0 rounded-none"
                            value={field.value ?? ""}
                            placeholder={placeholder}
                            onChange={(e) => field.onChange(parse ? parse(e.target.value) : e.target.value)}
                            onBlur={() => { field.onBlur(); meta?.endEdit(); }}
                            onKeyDown={handleInputKeyDown}
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                        />
                    )
                ) : (
                    <div className="h-full w-full text-sm flex items-center px-1">
                        {inputType === "switch" ? (
                            <div className="px-1"><Switch checked={!!field.value} disabled /></div>
                        ) : inputType === "select" ? (
                            <span className="truncate w-full block pointer-events-none select-none">
                                {options?.find(o => String(o.value) === String(field.value))?.label ?? displayValue}
                            </span>
                        ) : inputType === "media" ? (
                            field.value ? (
                                <img src={field.value} className="h-8 w-8 object-cover rounded shadow-sm shrink-0" alt="" />
                            ) : (
                                <span className="text-xs text-muted-foreground mr-1">صورة مفقودة</span>
                            )
                        ) : (
                            <span className="truncate w-full block pointer-events-none select-none">
                                {displayValue ?? ''}
                            </span>
                        )}
                        {hasError && (
                            <AlertCircle className="w-3.5 h-3.5 text-destructive ml-1 mr-auto shrink-0" />
                        )}
                    </div>
                )}
            </div>

            {/* Drag Handle - Improved aesthetic */}
            {isFocused && !isEditing && (
                <div
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 translate-x-[1px] translate-y-[1px] cursor-crosshair rounded-full bg-primary ring-2 ring-background z-20 hover:scale-125 transition-transform"
                    style={{ left: 'auto', right: -3, bottom: -3 }} // Correct RTL positioning concept, assuming global LTR with RTL content, or strict positioning
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        meta?.beginFill(coord);
                    }}
                    title="سحب للتعبئة"
                />
            )}
        </div>
    );
}

export const EditableCell = React.memo(EditableCellBase);