"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

// Define custom type for column meta to include hidden property
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    hidden?: boolean;
  }
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onQueryChange: (queryParams: {
    searchValue?: string;
    searchOperator?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    filterField?: string;
    filterOperator?: string;
    filterValue?: string;
  }) => void;
  totalCount?: number;
  isLoading?: boolean;
  initialParams?: {
    searchValue?: string;
    searchOperator?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
    filterField?: string;
    filterOperator?: string;
    filterValue?: string;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onQueryChange,
  totalCount = 0,
  isLoading = false,
  initialParams = {},
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(
    initialParams.sortBy && initialParams.sortDirection 
      ? [{ id: initialParams.sortBy, desc: initialParams.sortDirection === "desc" }] 
      : []
  )
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [searchValue, setSearchValue] = React.useState<string>(initialParams.searchValue || "")
  const [searchOperator, setSearchOperator] = React.useState<string>(initialParams.searchOperator || "contains")
  
  // Initialize pagination from URL params
  const initialPageSize = initialParams.limit || 10
  const initialOffset = initialParams.offset || 0
  const initialPageIndex = Math.floor(initialOffset / initialPageSize)
  
  const [pageSize, setPageSize] = React.useState<number>(initialPageSize)
  const [pageIndex, setPageIndex] = React.useState<number>(initialPageIndex)
  
  const [filterField, setFilterField] = React.useState<string>(initialParams.filterField || "")
  const [filterOperator, setFilterOperator] = React.useState<string>(initialParams.filterOperator || "eq")
  const [filterValue, setFilterValue] = React.useState<string>(initialParams.filterValue || "")

  // Add a ref to prevent the initial render from causing an update
  const isInitialMount = React.useRef(true);

  // Initialize column visibility state
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    // Set initial visibility based on column meta data
    const initialVisibility: VisibilityState = {};
    columns.forEach(column => {
      if (column.meta?.hidden) {
        const columnId = typeof column.id === 'string' ? column.id : String(column.id);
        initialVisibility[columnId] = false;
      }
    });
    return initialVisibility;
  });

  // Apply changes when relevant state changes
  React.useEffect(() => {
    // Skip the first render to avoid unnecessary updates
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    onQueryChange({
      searchValue: searchValue || undefined,
      searchOperator: searchValue ? searchOperator : undefined,
      limit: pageSize,
      offset: pageIndex * pageSize,
      sortBy: sorting.length > 0 ? sorting[0].id : undefined,
      sortDirection: sorting.length > 0 ? sorting[0].desc ? "desc" : "asc" : undefined,
      filterField: filterField === "none" ? undefined : filterField,
      filterOperator: filterField && filterField !== "none" ? filterOperator : undefined,
      filterValue: filterField && filterField !== "none" ? filterValue : undefined,
    });
  }, [sorting, pageSize, pageIndex, searchValue, searchOperator, filterField, filterOperator, filterValue, onQueryChange]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      pagination: {
        pageIndex,
        pageSize,
      },
      columnVisibility,
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: Math.ceil(totalCount / pageSize),
  })

  const filterableColumns = React.useMemo(() => {
    return columns.filter((column) => 
      'accessorKey' in column && typeof column.accessorKey === 'string'
    ).map(column => ({
      id: 'accessorKey' in column ? String(column.accessorKey) : '',
      title: typeof column.header === 'string' ? column.header : 'accessorKey' in column ? String(column.accessorKey) : ''
    }));
  }, [columns]);

  // Calculate total pages for pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pageNumbers: (number | 'ellipsis')[] = [];
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    
    // Always show first page
    pageNumbers.push(0);
    
    // Show ellipsis if needed
    if (pageIndex > 2) {
      pageNumbers.push('ellipsis');
    }
    
    // Calculate range around current page
    const startPage = Math.max(1, pageIndex - 1);
    const endPage = Math.min(totalPages - 2, pageIndex + 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    // Show ellipsis if needed
    if (pageIndex < totalPages - 3) {
      pageNumbers.push('ellipsis');
    }
    
    // Always show last page
    if (totalPages > 1) {
      pageNumbers.push(totalPages - 1);
    }
    
    return pageNumbers;
  };

  // Function to create conditional href based on button state
  const getPageHref = (page: number, isDisabled: boolean) => {
    if (isDisabled) return "#";
    
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    if (searchOperator !== "contains") params.set('searchOp', searchOperator);
    params.set('limit', pageSize.toString());
    params.set('offset', (page * pageSize).toString());
    params.set('page', (page + 1).toString()); // Human-readable page number
    
    if (sorting.length > 0) {
      params.set('sortBy', sorting[0].id);
      params.set('sortDir', sorting[0].desc ? "desc" : "asc");
    }
    
    if (filterField && filterField !== "none") {
      params.set('filterField', filterField);
      params.set('filterOp', filterOperator);
      params.set('filterValue', filterValue);
    }
    
    return `?${params.toString()}`;
  };

  // In pagination items, update to use onClick handlers instead of just href
  const handlePageClick = (page: number) => {
    if (page >= 0 && page < totalPages) {
      setPageIndex(page);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {/* Search Input */}
        <div className="flex flex-1 items-center space-x-2 rtl:space-x-2-reverse">
          <Input
            placeholder="بحث..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="max-w-sm"
          />
          <Select dir="rtl"
            value={searchOperator}
            onValueChange={setSearchOperator}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="نوع البحث" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">يحتوي على</SelectItem>
              <SelectItem value="startsWith">يبدأ بـ</SelectItem>
              <SelectItem value="endsWith">ينتهي بـ</SelectItem>
              <SelectItem value="eq">يساوي</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Filter Controls */}
        <div className="flex items-center space-x-2 rtl:space-x-2-reverse">
          <Select dir="rtl"
            value={filterField}
            onValueChange={setFilterField}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="اختر حقل التصفية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون تصفية</SelectItem>
              {filterableColumns.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  {column.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {filterField && filterField !== "none" && (
            <>
              <Select dir="rtl"
                value={filterOperator}
                onValueChange={setFilterOperator}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="نوع التصفية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">يساوي</SelectItem>
                  <SelectItem value="neq">لا يساوي</SelectItem>
                  <SelectItem value="gt">أكبر من</SelectItem>
                  <SelectItem value="gte">أكبر من أو يساوي</SelectItem>
                  <SelectItem value="lt">أصغر من</SelectItem>
                  <SelectItem value="lte">أصغر من أو يساوي</SelectItem>
                </SelectContent>
              </Select>
              
              <Input
                placeholder="قيمة التصفية"
                value={filterValue}
                onChange={(event) => setFilterValue(event.target.value)}
                className="max-w-sm"
              />
            </>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : <div
                            className={header.column.getCanSort() ? "cursor-pointer select-none flex items-center" : ""}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {{
                              asc: " ↑",
                              desc: " ↓",
                            }[header.column.getIsSorted() as string] ?? ""}
                          </div>
                      }
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-right">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  لا يوجد بيانات
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 rtl:space-x-2-reverse">
          <p className="text-sm text-muted-foreground">
            عرض <span>{Math.min(pageSize, totalCount)}</span> من <span>{totalCount}</span> النتائج
          </p>
          <Select dir="rtl" 
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(Number(value))
              setPageIndex(0)
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Pagination dir="rtl">
          <PaginationContent>
            <PaginationItem>
              <PaginationLink 
                href={getPageHref(0, pageIndex === 0)}
                onClick={(e) => {
                  if (pageIndex !== 0) {
                    e.preventDefault();
                    handlePageClick(0);
                  }
                }}
                className={pageIndex === 0 ? "pointer-events-none opacity-50" : ""}
              >
                الأول
              </PaginationLink>
            </PaginationItem>
            
            <PaginationItem>
              <PaginationPrevious 
                href={getPageHref(pageIndex - 1, pageIndex === 0)}
                onClick={(e) => {
                  if (pageIndex !== 0) {
                    e.preventDefault();
                    handlePageClick(pageIndex - 1);
                  }
                }}
                className={pageIndex === 0 ? "pointer-events-none opacity-50" : ""}
              >
                السابق
              </PaginationPrevious>
            </PaginationItem>
            
            {getPageNumbers().map((page, i) => (
              page === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    href={getPageHref(page as number, false)}
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageClick(page as number);
                    }}
                    isActive={page === pageIndex}
                  >
                    {(page as number) + 1}
                  </PaginationLink>
                </PaginationItem>
              )
            ))}
            
            <PaginationItem>
              <PaginationNext 
                href={getPageHref(pageIndex + 1, pageIndex === totalPages - 1)}
                onClick={(e) => {
                  if (pageIndex !== totalPages - 1) {
                    e.preventDefault();
                    handlePageClick(pageIndex + 1);
                  }
                }}
                className={pageIndex === totalPages - 1 ? "pointer-events-none opacity-50" : ""}
              >
                التالي
              </PaginationNext>
            </PaginationItem>
            
            <PaginationItem>
              <PaginationLink 
                href={getPageHref(totalPages - 1, pageIndex === totalPages - 1)}
                onClick={(e) => {
                  if (pageIndex !== totalPages - 1) {
                    e.preventDefault();
                    handlePageClick(totalPages - 1);
                  }
                }}
                className={pageIndex === totalPages - 1 ? "pointer-events-none opacity-50" : ""}
              >
                الأخير
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
