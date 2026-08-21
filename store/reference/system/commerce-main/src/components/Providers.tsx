'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import AnalyticsBootstrap from '@/modules/analytics/client/AnalyticsBootstrap';
import ScrollTracker from '@/modules/analytics/client/ScrollTracker';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { CartProvider } from '@/components/providers/CartProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Use useState to ensure QueryClient is only created once per component instance
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <CartProvider>
          <ToastProvider>
            <React.Suspense fallback={null}>
              <AnalyticsBootstrap />
              <ScrollTracker />
            </React.Suspense>
            {children}
            <Toaster />
          </ToastProvider>
        </CartProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}