import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  Truck,
  User,
} from 'lucide-react'

import { formatDateTime } from '@/lib/format'
import { useOrderTrackingTimeline } from '@/lib/queries/cod-reconciliation'
import { cn } from '@/lib/utils'

interface OrderTrackingTimelineProps {
  orderNumberOrId: string
}

export function OrderTrackingTimeline({ orderNumberOrId }: OrderTrackingTimelineProps) {
  const { data: timeline, isLoading, error } = useOrderTrackingTimeline(orderNumberOrId)

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-border bg-card p-4">
        <Clock className="size-5 animate-spin text-primary" />
        <span className="ms-2 text-xs text-muted-foreground">جاري تحميل حركات التتبع...</span>
      </div>
    )
  }

  if (error || !timeline) {
    return null
  }

  const events = timeline.events || []

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Truck className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-foreground">تتبع الشحنة والربط المباشر</h4>
            <p className="text-[11px] text-muted-foreground">
              {timeline.courier_name} {timeline.tracking_number ? `— #${timeline.tracking_number}` : ''}
            </p>
          </div>
        </div>

        {timeline.tracking_url && (
          <a
            href={timeline.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            <span>رابط التتبع الخارجي</span>
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {events.length === 0 ? (
        <div className="py-6 text-center text-xs font-bold text-muted-foreground">
          بانتظار استلام الشحنة من قبل المندوب وبدء تسجيل حركات التتبع
        </div>
      ) : (
        <div className="relative ps-6 space-y-6 before:absolute before:start-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {events.map((event, idx) => {
            const isLatest = idx === events.length - 1
            return (
              <div key={event.id} className="relative space-y-1">
                {/* Bullet Node */}
                <div
                  className={cn(
                    'absolute -start-6 top-0.5 flex size-5 items-center justify-center rounded-full border bg-card transition-colors',
                    isLatest
                      ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {isLatest ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <div className="size-1.5 rounded-full bg-current" />
                  )}
                </div>

                {/* Event Details */}
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className={cn('text-xs font-black', isLatest ? 'text-primary' : 'text-foreground')}>
                    {event.status_label_ar}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatDateTime(event.occurred_at)}
                  </span>
                </div>

                {event.location && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="size-3 shrink-0 text-primary" />
                    <span>{event.location}</span>
                  </div>
                )}

                {event.driver_name && (
                  <div className="flex items-center gap-3 text-[11px] text-foreground bg-muted/40 rounded-xl p-2 mt-1">
                    <div className="flex items-center gap-1">
                      <User className="size-3 text-muted-foreground" />
                      <span className="font-bold">المندوب: {event.driver_name}</span>
                    </div>
                    {event.driver_phone && (
                      <a
                        href={`tel:${event.driver_phone}`}
                        className="flex items-center gap-1 font-mono text-primary hover:underline"
                      >
                        <Phone className="size-3" />
                        <span>{event.driver_phone}</span>
                      </a>
                    )}
                  </div>
                )}

                {event.notes && (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5">{event.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
