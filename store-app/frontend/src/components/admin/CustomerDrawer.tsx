import { Phone } from 'lucide-react'

import { CustomerProfilePanel, FullProfileLink } from '@/components/admin/CustomerProfilePanel'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useCustomerProfile } from '@/lib/queries/crm'

/**
 * A customer's file at a glance, opened from the customers list, an order's
 * page or the order quick view without leaving where you are.
 */
export function CustomerDrawer({
  customerId,
  onOpenChange,
}: {
  customerId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: profile } = useCustomerProfile(customerId)

  return (
    <Sheet open={Boolean(customerId)} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[94vw] max-w-lg overflow-y-auto sm:max-w-lg">
        <div className="space-y-1 pe-12">
          <SheetTitle className="text-lg font-black">{profile?.name || 'ملف العميل'}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-1.5 font-mono text-sm">
              {profile?.phone_number ? (
                <a href={`tel:${profile.phone_number}`} className="inline-flex min-h-8 items-center gap-1.5 hover:text-primary">
                  <Phone className="size-4" aria-hidden="true" />
                  <bdi>{profile.phone_number}</bdi>
                </a>
              ) : (
                <span>…</span>
              )}
            </div>
          </SheetDescription>
        </div>
        <div className="mt-4">{customerId ? <CustomerProfilePanel customerId={customerId} compact /> : null}</div>
        {customerId ? (
          <div className="mt-5 border-t border-border pt-4">
            <FullProfileLink customerId={customerId} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
