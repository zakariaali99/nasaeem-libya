"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable,
    type VisibilityState,
    type ColumnPinningState,
    type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFieldArray, FormProvider, useForm, type FieldArrayWithId } from "react-hook-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BulkEditorProps, CellCoord, BulkEditorColumn, BulkEditorSchema } from "./types";
import { EditableCell } from "./editable-cell";
import { BulkEditorToolbar } from "./toolbar";
import { ColumnBulkAction } from "./column-action";
import type { BulkTableMeta, DragState } from "./types.internal";

const keyFor = (coord: CellCoord) => `${coord.rowIndex}:${coord.columnId}`;

function buildColumns(
    cols: BulkEditorColumn<any>[],
    getPath: (rowIndex: number, columnId: string) => string
): ColumnDef<any>[] {
    return cols.map((col) => ({
        id: col.id,
        accessorKey: col.id,
        header: col.header,
        size: (col.meta?.size as number | undefined),
        meta: { align: col.meta?.align ?? "right", inputType: col.inputType },
        cell: (ctx) => (
            <EditableCell
                table={ctx.table}
                rowIndex={ctx.row.index}
                columnId={col.id}
                path={getPath(ctx.row.index, col.path)}
                inputType={col.inputType}
                placeholder={col.placeholder}
                options={col.options}
                parse={col.parse}
                format={col.format}
            />
        ),
    })) as ColumnDef<any>[];
}

export function BulkEditor<TSchema extends BulkEditorSchema>({
    schema,
    defaultValues,
    columns,
    title,
    description,
    onSubmit,
}: BulkEditorProps<TSchema>) {
    const form = useForm<any>({
        resolver: zodResolver(schema),
        mode: "onBlur",
        defaultValues: defaultValues as any,
    });

    // History (Undo/Redo) stack
    const [history, setHistory] = React.useState<{ rows: any[] }[]>([{ rows: defaultValues?.rows || [] }]);
    const [historyIndex, setHistoryIndex] = React.useState(0);
    const stopHistoryRef = React.useRef(false);

    const { control, getValues, setValue, formState, handleSubmit } = form;
    const { fields } = useFieldArray({ name: "rows" as const, control });

    const [focusCell, setFocusCell] = React.useState<CellCoord | null>(null);
    const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());

    // REF FIX: Keep a ref to drag state so 'endFill' and 'hoverFill' can access it without
    // triggering table-wide re-renders.
    const dragStateRef = React.useRef<DragState>({ active: false });

    const [editingCell, setEditingCell] = React.useState<CellCoord | null>(null);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [globalFilter, setGlobalFilter] = React.useState("");

    const columnsDef = React.useMemo(
        () =>
            buildColumns(columns, (rowIndex, path) => {
                return `rows.${rowIndex}.${path}`;
            }),
        [columns]
    );

    const data = fields as unknown as FieldArrayWithId<{ rows: any[] }, "rows", "id">[];

    const moveFocus = React.useCallback(
        (direction: "up" | "down" | "left" | "right") => {
            if (!focusCell) return;
            const columnIds = columnsDef.map((c) => c.id as string);
            const currentColIdx = columnIds.indexOf(focusCell.columnId);
            const lastRow = data.length - 1;

            if (direction === "up") {
                setFocusCell({
                    columnId: focusCell.columnId,
                    rowIndex: Math.max(0, focusCell.rowIndex - 1),
                });
            } else if (direction === "down") {
                setFocusCell({
                    columnId: focusCell.columnId,
                    rowIndex: Math.min(lastRow, focusCell.rowIndex + 1),
                });
            } else if (direction === "left") {
                // RTL: Left arrow moves to next index (Visually Left)
                const nextIndex = Math.min(columnIds.length - 1, currentColIdx + 1);
                setFocusCell({ columnId: columnIds[nextIndex], rowIndex: focusCell.rowIndex });
            } else if (direction === "right") {
                // RTL: Right arrow moves to prev index (Visually Right)
                const nextIndex = Math.max(0, currentColIdx - 1);
                setFocusCell({ columnId: columnIds[nextIndex], rowIndex: focusCell.rowIndex });
            }
        },
        [columnsDef, data.length, focusCell]
    );

    const handleCellClick = React.useCallback(
        (event: React.MouseEvent, coord: CellCoord) => {
            const key = keyFor(coord);
            if (event.shiftKey && focusCell) {
                const [start, end] = [focusCell.rowIndex, coord.rowIndex].sort((a, b) => a - b);
                const range = new Set<string>();
                for (let r = start; r <= end; r++) {
                    range.add(keyFor({ rowIndex: r, columnId: coord.columnId }));
                }
                setSelectedKeys(range);
            } else if (event.metaKey || event.ctrlKey) {
                setSelectedKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                });
            } else {
                setSelectedKeys(new Set([key]));
            }
            setFocusCell(coord);
        },
        [focusCell]
    );

    const beginFill = React.useCallback((coord: CellCoord) => {
        dragStateRef.current = { active: true, origin: coord, targetRowIndex: coord.rowIndex };
    }, []);

    const beginEdit = React.useCallback((coord: CellCoord) => {
        setEditingCell(coord);
        setFocusCell(coord);
    }, []);

    const pushHistory = React.useCallback(() => {
        if (stopHistoryRef.current) return;

        // Wait for RHF to commit its state to `getValues`
        setTimeout(() => {
            if (stopHistoryRef.current) return;
            setHistory(prev => {
                const currentRows = getValues("rows");
                // Deep clone to avoid mutating history
                const cloned = JSON.parse(JSON.stringify(currentRows));

                // If the state hasn't changed from the last history item, don't push
                if (prev.length > 0 && JSON.stringify(prev[prev.length - 1].rows) === JSON.stringify(cloned)) {
                    return prev;
                }

                const newHistory = prev.slice(0, historyIndex + 1);
                newHistory.push({ rows: cloned });
                setHistoryIndex(newHistory.length - 1);
                return newHistory; // limit buffer size to 50 later if needed
            });
        }, 10);
    }, [getValues, historyIndex]);

    const handleUndo = React.useCallback(() => {
        if (historyIndex > 0) {
            const newIdx = historyIndex - 1;
            stopHistoryRef.current = true;

            // Extract target state from history
            const targetRows = JSON.parse(JSON.stringify(history[newIdx].rows));

            // Using setValue on the array root does not reliably trigger full UI re-renders for useFieldArray in some versions of RHF unless you map over it and 'field-by-field' or use reset.
            // A reliable way for full replace using setValue is setting each item, or simply resetting the whole form:
            form.reset({ rows: targetRows }, { keepDirty: true, keepErrors: true });

            setHistoryIndex(newIdx);
            setTimeout(() => { stopHistoryRef.current = false; }, 100);
        }
    }, [history, historyIndex, form]);

    const handleRedo = React.useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIdx = historyIndex + 1;
            stopHistoryRef.current = true;

            const targetRows = JSON.parse(JSON.stringify(history[newIdx].rows));
            form.reset({ rows: targetRows }, { keepDirty: true, keepErrors: true });

            setHistoryIndex(newIdx);
            setTimeout(() => { stopHistoryRef.current = false; }, 100);
        }
    }, [history, historyIndex, form]);

    const endEdit = React.useCallback(() => {
        setEditingCell(null);
        // Ensure focus returns to cell after edit
        const t = document.activeElement as HTMLElement;
        t?.blur();
        pushHistory(); // Capture change
    }, [pushHistory]);

    const hoverFill = React.useCallback((rowIndex: number) => {
        const currentDrag = dragStateRef.current;
        if (!currentDrag.active || !currentDrag.origin) return;

        // Update target index immediately (lightweight)
        dragStateRef.current = { ...currentDrag, targetRowIndex: rowIndex };

        // Visual DOM updates to avoid massive re-renders
        const { origin } = currentDrag;
        const start = Math.min(origin.rowIndex, rowIndex);
        const end = Math.max(origin.rowIndex, rowIndex);
        const colId = origin.columnId;

        document.querySelectorAll('.cell-fill-preview').forEach(el => el.classList.remove('cell-fill-preview', 'bg-primary/10'));

        for (let r = start; r <= end; r++) {
            const el = document.querySelector(`[data-cell-id="${r}:${colId}"]`);
            if (el) el.classList.add('cell-fill-preview', 'bg-primary/10');
        }
    }, []);

    const endFill = React.useCallback(() => {
        const currentDrag = dragStateRef.current;

        // Cleanup visuals
        document.querySelectorAll('.cell-fill-preview').forEach(el => el.classList.remove('cell-fill-preview', 'bg-primary/10'));

        if (!currentDrag.active || currentDrag.origin === undefined || currentDrag.targetRowIndex === undefined) {
            dragStateRef.current = { active: false };
            return;
        }

        const { origin, targetRowIndex } = currentDrag;

        if (targetRowIndex !== origin.rowIndex) {
            const value = getValues(`rows.${origin.rowIndex}.${origin.columnId}` as any);
            const [start, end] = targetRowIndex > origin.rowIndex
                ? [origin.rowIndex + 1, targetRowIndex]
                : [targetRowIndex, origin.rowIndex - 1];

            // Batch updates without triggering deep validation loop until save (shouldDirty)
            for (let i = start; i <= end; i++) {
                setValue(`rows.${i}.${origin.columnId}` as any, value, {
                    shouldDirty: true,
                    shouldTouch: true,
                });
            }
            pushHistory(); // Capture batch fill
        }

        dragStateRef.current = { active: false };
    }, [getValues, setValue, pushHistory]);

    const parentRef = React.useRef<HTMLDivElement>(null);

    // To access the table instance in the callback
    const tableRef = React.useRef<any>(null);

    const applyBulkAction = React.useCallback((columnId: string, actionType: "increase" | "decrease" | "percentage" | "set", value: number, applyTo: "all" | "selected") => {
        const currentRows = getValues("rows") as any[];

        let targetIndices: number[] = [];
        if (applyTo === "selected") {
            const rowIndices = new Set<number>();
            selectedKeys.forEach(k => {
                const [rStr, cStr] = k.split(':');
                if (cStr === columnId) rowIndices.add(parseInt(rStr, 10));
            });
            targetIndices = Array.from(rowIndices);
        } else {
            // "all" means all rows currently rendered or filtered
            if (tableRef.current) {
                targetIndices = tableRef.current.getRowModel().rows.map((r: any) => r.index);
            } else {
                targetIndices = currentRows.map((_, i) => i);
            }
        }

        if (targetIndices.length === 0) return;

        targetIndices.forEach(idx => {
            const currentValStr = String(currentRows[idx][columnId] ?? '0');
            // Remove non-numeric characters for valid math manipulation if possible
            const currentVal = Number(currentValStr.replace(/[^0-9.-]+/g, "")) || 0;

            let newVal = currentVal;
            if (actionType === "set") newVal = value;
            else if (actionType === "increase") newVal += value;
            else if (actionType === "decrease") newVal -= value;
            else if (actionType === "percentage") newVal = newVal * (1 + (value / 100));

            // Ensure to round down to 2 decimals to prevent floating point nonsense
            newVal = Math.round(newVal * 100) / 100;

            setValue(`rows.${idx}.${columnId}` as any, newVal, { shouldDirty: true, shouldTouch: true });
        });

        pushHistory();
    }, [getValues, setValue, selectedKeys, pushHistory]);

    React.useEffect(() => {
        const handleUp = () => endFill();
        const handleLeave = () => {
            document.querySelectorAll('.cell-fill-preview').forEach(el => el.classList.remove('cell-fill-preview', 'bg-primary/10'));
            dragStateRef.current = { active: false };
        };
        window.addEventListener("mouseup", handleUp);
        window.addEventListener("mouseleave", handleLeave);
        return () => {
            window.removeEventListener("mouseup", handleUp);
            window.removeEventListener("mouseleave", handleLeave);
        };
    }, [endFill]);

    // Clipboard Support (Copy/Paste) and Undo/Redo
    React.useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
                return;
            }

            if (!focusCell) return;
            // Skip if user is actively editing a cell
            if (editingCell) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                // Copy the actively focused cell value
                const v = getValues(`rows.${focusCell.rowIndex}.${focusCell.columnId}` as any);
                await navigator.clipboard.writeText(String(v ?? ''));
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                // Paste into selected cells, or focused cell if no multi-selection
                const text = await navigator.clipboard.readText();
                if (selectedKeys.size > 0) {
                    selectedKeys.forEach(k => {
                        const [r, c] = k.split(':');
                        setValue(`rows.${r}.${c}` as any, text, { shouldDirty: true, shouldTouch: true });
                    });
                } else {
                    setValue(`rows.${focusCell.rowIndex}.${focusCell.columnId}` as any, text, { shouldDirty: true, shouldTouch: true });
                }
                pushHistory(); // Capture paste edit
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusCell, selectedKeys, editingCell, getValues, setValue, pushHistory]);

    // Handle column pinning
    const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>({
        right: columns.filter((c) => c.meta?.pinned).map((c) => c.id), // PIN TO RIGHT IN RTL
    });

    const table = useReactTable({
        data,
        columns: columnsDef,
        getCoreRowModel: getCoreRowModel(),
        state: {
            columnVisibility,
            columnPinning,
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onColumnPinningChange: setColumnPinning,
        meta: {
            focusCell,
            selectedKeys,
            handleCellClick,
            moveFocus,
            beginFill,
            hoverFill,
            endFill,
            beginEdit,
            endEdit,
            editingCell,
            undo: handleUndo,
            redo: handleRedo,
            canUndo: historyIndex > 0,
            canRedo: historyIndex < history.length - 1,
            applyBulkAction
        } satisfies BulkTableMeta,
    });
    tableRef.current = table;

    const dirtyRows = React.useMemo(() => (formState.dirtyFields as any)?.rows || [], [formState.dirtyFields]);

    const submit = handleSubmit(async (values) => {
        const payload = [] as Array<{ rowIndex: number; id?: string; changes: Record<string, any> }>;
        dirtyRows.forEach((rowDirty: any, idx: number) => {
            if (!rowDirty) return;
            const changes: Record<string, any> = {};
            Object.keys(rowDirty).forEach((key) => {
                changes[key] = values.rows[idx][key];
            });
            if (Object.keys(changes).length > 0) {
                payload.push({ rowIndex: idx, id: (values as any).rows[idx]?.id, changes });
            }
        });
        await onSubmit({ dirtyRows: payload, values } as any);
    });

    const hasDirty = formState.isDirty && (dirtyRows?.length ?? 0) > 0;

    const { rows } = table.getRowModel();
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50,
        overscan: 20,
    });

    return (
        <FormProvider {...form}>
            <div className="w-full h-full flex flex-col min-w-0 flex-1" dir="rtl">
                <div className="flex flex-col gap-1 px-1 shrink-0">
                    {title ? <h2 className="text-xl font-semibold leading-tight">{title}</h2> : null}
                    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
                </div>
                <BulkEditorToolbar
                    table={table}
                    onSubmit={submit}
                    isSaving={formState.isSubmitting}
                    dirtyCount={hasDirty ? dirtyRows.length : 0}
                />
                <div className="flex items-center space-x-2 my-4 px-1 shrink-0">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث..."
                            value={globalFilter ?? ""}
                            onChange={(event) => setGlobalFilter(event.target.value)}
                            className="pr-8 text-right"
                        />
                    </div>
                </div>
                <div className="rounded-lg border bg-background shadow-sm select-none flex flex-col flex-1 min-h-[400px] w-full overflow-hidden relative" role="grid">
                    {/* Horizontal Scroller */}
                    <div className="overflow-x-auto overflow-y-hidden flex-1 w-full flex flex-col">
                        <div className="min-w-max flex flex-col flex-1 relative h-full">
                            {/* Header */}
                            <div className="flex bg-muted/50 border-b z-20 font-medium text-sm sticky top-0" role="rowgroup">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <div key={headerGroup.id} className="flex w-full min-w-max" role="row">
                                        {headerGroup.headers.map((header) => {
                                            const size = header.getSize();
                                            const meta = header.column.columnDef.meta as any;
                                            const align = meta?.align;
                                            const inputType = meta?.inputType;

                                            // Pinning calculations for CSS
                                            const isPinned = header.column.getIsPinned();
                                            const isLastRightPinned = isPinned === 'right' && header.column.getIsLastColumn('right');

                                            return (
                                                <div
                                                    key={header.id}
                                                    role="columnheader"
                                                    className={cn(
                                                        "p-3 text-right flex items-center border-l last:border-l-0 shrink-0 bg-muted/50 transition-colors",
                                                        align === "left" && "justify-end text-left",
                                                        isPinned && "sticky z-20 shadow-[1px_0_0_rgba(0,0,0,0.1)]", // Drop shadow for pinned separation
                                                    )}
                                                    style={{
                                                        width: size ? `${size}px` : '150px',
                                                        flexGrow: size ? 0 : 1,
                                                        ...(isPinned === 'right' ? { right: `${header.column.getStart('right')}px` } : {})
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</span>
                                                        {inputType === 'number' && !header.isPlaceholder && (
                                                            <ColumnBulkAction columnId={header.column.id} table={table} />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>

                            {/* Virtual Body */}
                            <div
                                ref={parentRef}
                                className="overflow-y-auto overflow-x-hidden flex-1 w-full relative"
                                role="rowgroup"
                            >
                                <div
                                    style={{
                                        height: `${virtualizer.getTotalSize()}px`,
                                        width: '100%',
                                        position: 'relative',
                                    }}
                                >
                                    {virtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index];
                                        return (
                                            <div
                                                key={row.id}
                                                role="row"
                                                className={cn(
                                                    "absolute top-0 left-0 w-full flex border-b transition-colors hover:bg-muted/30",
                                                    row.getIsSelected() && "bg-muted"
                                                )}
                                                style={{
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                    minWidth: 'max-content',
                                                }}
                                            >
                                                {row.getVisibleCells().map((cell) => {
                                                    const size = cell.column.getSize();
                                                    const isPinned = cell.column.getIsPinned();
                                                    return (
                                                        <div
                                                            key={cell.id}
                                                            className={cn(
                                                                "p-0 border-l last:border-l-0 shrink-0 h-full bg-background transition-colors",
                                                                isPinned && "sticky z-10 shadow-[1px_0_0_rgba(0,0,0,0.1)]",
                                                                row.getIsSelected() && "bg-muted"
                                                            )}
                                                            style={{
                                                                width: size ? `${size}px` : '150px',
                                                                flexGrow: size ? 0 : 1,
                                                                ...(isPinned === 'right' ? { right: `${cell.column.getStart('right')}px` } : {})
                                                            }}
                                                        >
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </FormProvider>
    );
}