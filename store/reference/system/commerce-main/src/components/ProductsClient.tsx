"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { PaginatedProductsResult, Product } from "@/modules/products/types/productTypes";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ProductCard } from '@/components/ui/ProductCard';
import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { analyticsClient } from '@/modules/analytics/client/analyticsClient';

interface ProductsClientProps {
  initialData: PaginatedProductsResult;
  initialParams?: {
    search?: string;
    sortBy?: string;
    order?: string;
    categoryId?: string;
    collectionId?: string;
  };
}

export default function ProductsClient({ initialData, initialParams }: ProductsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL search params, falling back to provided initialParams or defaults
  const initSearch = searchParams.get('search') ?? initialParams?.search ?? "";
  const initSortBy = searchParams.get('sortBy') ?? initialParams?.sortBy ?? "createdAt";
  const initOrder = searchParams.get('order') ?? initialParams?.order ?? "desc";
  const initCategoryId = searchParams.get('categoryId') ?? initialParams?.categoryId ?? "";
  const initCollectionId = searchParams.get('collectionId') ?? initialParams?.collectionId ?? "";
  const initPage = (() => {
    const p = searchParams.get('page');
    const n = p ? parseInt(p, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : (initialData.page || 1);
  })();

  const [searchTerm, setSearchTerm] = useState(initSearch);
  // ⚡ Bolt: Debounce search input to avoid excessive API calls while typing
  // We keep the immediate input value in `searchTerm` and use the debounced
  // value for the actual API query. This improves performance significantly
  // on slower connections and reduces server load.
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [sortBy, setSortBy] = useState(initSortBy);
  const [order, setOrder] = useState(initOrder);
  const [categoryId, setCategoryId] = useState(initCategoryId);
  const [collectionId, setCollectionId] = useState(initCollectionId);
  const [page, setPage] = useState(initPage);
  const lastTrackedSignature = useRef<string | null>(null);

  // Update URL query params when filters or pagination change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sortBy) params.set('sortBy', sortBy);
    if (order) params.set('order', order);
    if (categoryId) params.set('categoryId', categoryId);
    if (collectionId) params.set('collectionId', collectionId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [page, debouncedSearch, sortBy, order, categoryId, collectionId, pathname, router]);

  // Sync URL search params back to state when they change externally (e.g., from categories sidebar)
  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? "";
    if (urlSearch !== debouncedSearch) setSearchTerm(urlSearch);

    const urlSortBy = searchParams.get('sortBy') ?? "createdAt";
    if (urlSortBy !== sortBy) setSortBy(urlSortBy);

    const urlOrder = searchParams.get('order') ?? "desc";
    if (urlOrder !== order) setOrder(urlOrder);

    const urlCategoryId = searchParams.get('categoryId') ?? "";
    if (urlCategoryId !== categoryId) setCategoryId(urlCategoryId);

    const urlCollectionId = searchParams.get('collectionId') ?? "";
    if (urlCollectionId !== collectionId) setCollectionId(urlCollectionId);

    const p = searchParams.get('page');
    const n = p ? parseInt(p, 10) : NaN;
    const urlPage = Number.isFinite(n) && n > 0 ? n : 1;
    if (urlPage !== page) setPage(urlPage);
  }, [searchParams]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, order, categoryId, collectionId]);

  const fetchProducts = async ({ queryKey }: any): Promise<PaginatedProductsResult> => {
    const [_key, { page, search, sortBy, order, categoryId, collectionId }] = queryKey;
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "12");
    if (search) params.set("search", search);
    if (sortBy) params.set("sortBy", sortBy);
    if (order) params.set("order", order);
    if (categoryId) params.set("categoryId", categoryId);
    if (collectionId) params.set("collectionId", collectionId);
    const res = await fetch(`/api/products?${params.toString()}`);
    if (!res.ok) throw new Error("فشل في جلب المنتجات");
    const json = await res.json();
    return json.data;
  };

  const { data, isLoading, isFetching } = useQuery<PaginatedProductsResult, Error>({
    queryKey: ["products", { page, search: debouncedSearch, sortBy, order, categoryId, collectionId }],
    queryFn: fetchProducts,
    initialData,
  });

  useEffect(() => {
    if (!data) return;
    const payload = {
      source: 'listing',
      search: debouncedSearch || undefined,
      sortBy,
      order,
      categoryId: categoryId || undefined,
      collectionId: collectionId || undefined,
      page,
      resultCount: data.data.length,
    };
    const signature = JSON.stringify(payload);
    if (signature === lastTrackedSignature.current) return;
    lastTrackedSignature.current = signature;
    analyticsClient.trackBrowse(payload);
    if (debouncedSearch) {
      analyticsClient.trackSearch(debouncedSearch, payload);
      if (data.data.length === 0) {
        analyticsClient.trackSearchNoResults(debouncedSearch, payload);
      }
    }
  }, [data, debouncedSearch, sortBy, order, categoryId, collectionId, page]);

  const showLoading = isLoading || (!data && isFetching);

  // Helper to force a specific image size folder (thumbnail|medium|large|full)
  const getSizedImageUrl = (url?: string, size: 'thumbnail' | 'medium' | 'large' | 'full' = 'medium') => {
    if (!url) return "";
    // Replace any existing size segment with the target size
    const sized = url.replace(/\/uploads\/images\/(thumbnail|medium|large|full)\//, `/uploads/images/${size}/`);
    // If no size folder was present, attempt to prefix with the target folder while keeping filename
    if (sized === url) {
      const parts = url.split('/');
      const filename = parts.pop() || '';
      const base = parts.join('/');
      if (base.endsWith('/uploads/images')) {
        return `${base}/${size}/${filename}`;
      }
    }
    return sized;
  };

  const sharedQuery = `&search=${debouncedSearch}&sortBy=${sortBy}&order=${order}${categoryId ? `&categoryId=${categoryId}` : ''}${collectionId ? `&collectionId=${collectionId}` : ''}`;

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <form
          onSubmit={e => {
            e.preventDefault();
            setPage(1);
          }}
          className="flex items-center relative w-full max-w-md"
        >
          <Button type="submit" className="rounded-l-none rounded-r-md">
            <Search className="h-5 w-5" />
          </Button>
          <Input
            type="search"
            placeholder="ابحث عن منتجات..."
            className="flex-grow rounded-r-none rounded-l-md text-right"
            dir="rtl"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setPage(1);
              }
            }}
          />
        </form>
        {/* Sorting and Filters */}
        <Select onValueChange={(v) => {
          setSortBy(v);
          setPage(1);
          analyticsClient.trackFilterSort('sort_change', {
            source: 'listing',
            sortBy: v,
            order,
            search: debouncedSearch || undefined,
            categoryId: categoryId || undefined,
            collectionId: collectionId || undefined,
          });
        }}>
          <SelectTrigger>
            <SelectValue placeholder="فرز حسب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">الأحدث</SelectItem>
            <SelectItem value="price">السعر</SelectItem>
            <SelectItem value="name">الاسم</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => {
          setOrder(v);
          setPage(1);
          analyticsClient.trackFilterSort('order_change', {
            source: 'listing',
            sortBy,
            order: v,
            search: debouncedSearch || undefined,
            categoryId: categoryId || undefined,
            collectionId: collectionId || undefined,
          });
        }}>
          <SelectTrigger>
            <SelectValue placeholder="ترتيب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">تنازلي</SelectItem>
            <SelectItem value="asc">تصاعدي</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => {
            setPage(1);
            analyticsClient.trackFilterSort('apply_filters', {
              source: 'listing',
              search: debouncedSearch || undefined,
              sortBy,
              order,
              categoryId: categoryId || undefined,
              collectionId: collectionId || undefined,
              page: 1,
            });
          }}
        >
          تطبيق
        </Button>
      </div>
      {showLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" aria-label="تحميل المنتجات">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-lg border p-3 space-y-3">
              <div className="h-32 bg-muted rounded-md" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-8 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : data && data.data.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-lg font-semibold">لا توجد نتائج مطابقة حالياً.</p>
          <p className="text-sm text-muted-foreground">جرّب تعديل البحث أو توسيع الفلترة.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {data?.data.map((prod: Product) => (
              <ProductCard
                key={prod.id}
                name={prod.name}
                price={prod.price}
                imageUrl={getSizedImageUrl(prod.images?.[0]?.url, 'medium')}
                slug={prod.slug}
                discounts={prod.discounts}
                productId={prod.id}
                hasVariants={prod.hasVariants}
                availableQuantity={prod.trackQuantity ? (prod.hasVariants ? null : (prod.stock ?? 0)) : null}
              />
            ))}
          </div>
          <Pagination className="mt-8">
            <PaginationPrevious
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              href={`?page=${page - 1}${sharedQuery}`}
              isActive={page > 1}
            />
            <PaginationContent>
              {Array.from({ length: data?.totalPages || 0 }).map((_, idx) => {
                const p = idx + 1;
                if (data && (p === 1 || p === data.totalPages || (p >= data.page - 2 && p <= data.page + 2))) {
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href={`?page=${p}${sharedQuery}`}
                        isActive={p === data.page}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }
                if (data && (p === data.page - 3 || p === data.page + 3)) {
                  return (
                    <PaginationItem key={p}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              })}
            </PaginationContent>
            <PaginationNext
              onClick={() => data && setPage((prev) => Math.min(prev + 1, data.totalPages))}
              href={`?page=${data?.page + 1}${sharedQuery}`}
              isActive={data ? page < data.totalPages : false}
            />
          </Pagination>
        </>
      )}
    </div>
  );
}
