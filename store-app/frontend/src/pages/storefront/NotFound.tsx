import { SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/usePageTitle'

/** An unknown address, inside the store's header and footer so the visitor
 * can carry on shopping instead of landing on a bare error screen. */
export default function NotFoundPage() {
  usePageTitle('الصفحة غير موجودة — نسائم ليبيا')
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-20 text-center">
      <SearchX className="size-12 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
        <p className="text-sm text-muted-foreground">الرابط الذي فتحته غير صحيح أو تم حذف الصفحة.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/products">تصفّح العطور</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">الصفحة الرئيسية</Link>
        </Button>
      </div>
    </div>
  )
}
