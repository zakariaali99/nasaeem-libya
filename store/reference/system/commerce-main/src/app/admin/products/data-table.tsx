"use client";

import * as React from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    SortingState,
    getSortedRowModel,
    ColumnFiltersState,
    getFilteredRowModel,
    VisibilityState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button"; // Ensure Button is imported
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    initialSearch?: string;
    onSearchChange?: (value: string) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  initialSearch,
  onSearchChange,
}: DataTableProps<TData, TValue>) {
    const router = useRouter();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [search, setSearch] = React.useState(initialSearch ?? "");

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    });

    // Function to handle row click and navigate to edit page
    const handleRowClick = (id: string, slug?: string) => {
        const identifier = slug || id;
        router.push(`/admin/products/${identifier}`);
    };

        // Sync external search with consumer immediately (debounce handled by parent)
        React.useEffect(() => {
            if (onSearchChange) onSearchChange(search);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [search]);

        const safeTotalPages = Math.max(1, totalPages || 0);
        const canPrev = page > 1;
        const canNext = page < safeTotalPages;

    return (
        <div dir="rtl"> {/* RTL direction */}
            <div className="flex items-center py-4">
                <Input
                  placeholder="ابحث باسم المنتج..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm"
                />
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto mr-4"> {/* Adjusted margin for RTL */}
                            الأعمدة
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter(
                                (column) => column.getCanHide()
                            )
                            .map((column) => {
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {/* You might want to map accessorKey to Arabic names here */}
                                        {column.id === 'name' ? 'اسم المنتج' :
                                         column.id === 'price' ? 'السعر' :
                                         column.id === 'stock' ? 'المخزون' :
                                         column.id === 'actions' ? 'إجراءات' : column.id}
                                    </DropdownMenuCheckboxItem>
                                )
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="text-right"> {/* Align header text right */}
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    onClick={() => handleRowClick(
                                        (row.original as any).id, 
                                        (row.original as any).slug
                                    )}
                                    className="cursor-pointer hover:bg-muted/50"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="text-right"> {/* Align cell text right */}
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    لا توجد نتائج.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4">
                            <div className="text-sm text-muted-foreground">
                                إجمالي النتائج: {total.toLocaleString("ar-LY")} — صفحة {page} من {totalPages}
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
                                                    {/* Windowed page links */}
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