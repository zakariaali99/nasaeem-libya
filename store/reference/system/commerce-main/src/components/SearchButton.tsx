"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Product } from "@/modules/products/types/productTypes";
import { trackSearch, trackSearchSelect } from "@/modules/analytics/client/analyticsClient";
import { cn } from "@/lib/utils";

type SearchButtonProps = {
  buttonClassName?: string;
  iconOnly?: boolean;
};

export default function SearchButton({ buttonClassName, iconOnly = false }: SearchButtonProps = {}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const term = debouncedSearchTerm.trim();
    if (!open) return; // only fetch when sheet is open
    if (!term) {
      setSuggestions([]);
      return;
    }
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(term)}&limit=5`);
        const json = await res.json();
        const items = json.data?.data || [];
        setSuggestions(Array.isArray(items) ? items : []);
        trackSearch(term, { source: 'header_sheet', phase: 'suggestions', resultCount: Array.isArray(items) ? items.length : 0 });
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [debouncedSearchTerm, open]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;
    setOpen(false);
    trackSearch(term, { source: 'header_sheet', phase: 'submit' });
    router.push(`/products?search=${encodeURIComponent(term)}`);
  };

  const onSelectProduct = (slug: string) => {
    setOpen(false);
    trackSearchSelect(searchTerm.trim(), slug, { source: 'header_sheet' });
    router.push(`/products/${slug}`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className={cn("flex items-center gap-2", iconOnly ? "justify-center" : "", buttonClassName)}
          aria-label="بحث"
        >
          <Search className="h-5 w-5" />
          {!iconOnly && <span className="hidden md:inline">بحث</span>}
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="p-4" dir="rtl">
        <SheetHeader>
          <SheetTitle className="text-right">ابحث عن المنتجات</SheetTitle>
        </SheetHeader>
        <div className="w-full max-w-2xl mx-auto">
          <form onSubmit={onSubmit} className="flex items-center gap-2 mt-2">
            <Button type="submit" className="shrink-0 rounded-l-md rounded-r-none">
              <Search className="h-5 w-5" />
            </Button>
            <Input
              autoFocus
              type="search"
              placeholder="ابحث عن منتجات..."
              className="rounded-r-md rounded-l-none text-right"
              dir="rtl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>

          {(suggestions.length > 0 || isLoading) && (
            <ul className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow text-right overflow-hidden">
              {isLoading && (
                <li className="flex items-center justify-center px-4 py-3">
                  <Loader2 className="animate-spin h-5 w-5 text-gray-500" />
                  <span className="mr-2 text-gray-600">جاري البحث...</span>
                </li>
              )}
              {suggestions.map((prod) => (
                <li
                  key={prod.id}
                  onClick={() => onSelectProduct(prod.slug)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center p-2">
                    <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden ml-2">
                      {prod.images && prod.images[0]?.url ? (
                        <Image src={prod.images[0].url} alt={prod.name} fill className="object-cover" />
                      ) : (
                        <div className="bg-gray-200 w-full h-full" />
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{prod.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{prod.price}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
