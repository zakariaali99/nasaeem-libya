import { DiscoveryBoxBanner } from '@/components/storefront/DiscoveryBoxBanner'
import type { Widget } from '@/types/api'

export function DiscoveryBoxWidget({ widget }: { widget: Widget }) {
  const { data } = widget

  return (
    <div className="my-2">
      <DiscoveryBoxBanner
        title={data.title}
        badge={data.badge}
        description={data.description}
        features={data.features}
        linkUrl={data.linkUrl}
        buttonText={data.buttonText}
      />
    </div>
  )
}
