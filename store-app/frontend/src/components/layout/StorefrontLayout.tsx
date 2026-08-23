import { Outlet } from 'react-router-dom'

import { BottomNav } from '@/components/layout/BottomNav'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'

/** The shell every customer-facing route sits in. */
export function StorefrontLayout() {
  return (
    <div className="flex min-h-dvh flex-col w-full max-w-full overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        تخطَّ إلى المحتوى
      </a>
      <Header />
      {/* pb-16 clears the fixed bottom navigation on mobile. */}
      <main id="main" className="flex-1 pb-16 lg:pb-0 w-full max-w-full overflow-x-clip">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
