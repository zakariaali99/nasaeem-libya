'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import type { Product } from '@/modules/products/types/productTypes';
import { Loader2 } from 'lucide-react';
import { trackSearch, trackSearchSelect } from '@/modules/analytics/client/analyticsClient';

export default function HeroSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch suggestions on debounced search term
  useEffect(() => {
    const term = debouncedSearchTerm.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(term)}&limit=5`);
        const json = await res.json();
        // unwrap nested data array from API response
        const items = json.data?.data || [];
        setSuggestions(Array.isArray(items) ? items : []);
        trackSearch(term, { source: 'hero', phase: 'suggestions', resultCount: Array.isArray(items) ? items.length : 0 });
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [debouncedSearchTerm]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (term) {
      trackSearch(term, { source: 'hero', phase: 'submit' });
      router.push(`/products?search=${encodeURIComponent(term)}`);
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 py-20 px-4 text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
        أهلاً بك في متجر الموجة
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        أفضل المنتجات بأفضل الأسعار
      </p>
      <div className="max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="flex items-center relative">
          <Button type="submit" className="rounded-l-none rounded-r-md">
            <Search className="h-5 w-5" />
          </Button>
          <div className="relative flex-grow">
            <Input
              type="search"
              placeholder="ابحث عن منتجات..."
              className="flex-grow rounded-r-none rounded-l-md text-right"
              dir="rtl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {(suggestions.length > 0 || isLoading) && (
              <ul className="absolute right-0 left-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10 text-right overflow-hidden">
                {isLoading && (
                  <li className="flex items-center justify-center px-4 py-2">
                    <Loader2 className="animate-spin h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span className="mr-2 text-gray-600 dark:text-gray-300">جاري البحث...</span>
                  </li>
                )}
                {suggestions.map((prod) => (
                  <li
                    key={prod.id}
                    onClick={() => {
                      trackSearchSelect(searchTerm.trim(), prod.id, { source: 'hero' });
                      router.push(`/products/${prod.slug}`);
                    }}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <div className="flex items-center p-2">
                      <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden ml-2">
                        {prod.images && prod.images[0]?.url ? (
                          <Image
                            src={prod.images[0].url}
                            alt={prod.name}
                            fill
                            className="object-cover"
                          />
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
        </form>
      </div>
    </div>
  );
}
