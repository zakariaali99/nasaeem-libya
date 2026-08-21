"use client";

import ProductsClient from "@/components/ProductsClient";
import React, { Suspense } from "react";

export default function ProductsPage() {
  // This page is now client-only. ProductsClient will fetch from /api/products using react-query.
  // Provide a minimal empty initialData so the client component can render immediately and then refetch.
  const initialData = {
    data: [],
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 12,
  } as any;

  return (
    <div>
      {/* Wrap client component using useSearchParams in Suspense to avoid SSR bailout error */}
      <Suspense
        fallback={
          <div dir="rtl" className="p-6 text-center">
            جاري التحميل...
          </div>
        }
      >
        <ProductsClient initialData={initialData} initialParams={{}} />
      </Suspense>
    </div>
  );
}
