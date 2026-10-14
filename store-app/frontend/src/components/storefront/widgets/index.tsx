import { AnnouncementBar } from '@/components/storefront/widgets/AnnouncementBar'
import { Carousel, type BannerVariant } from '@/components/storefront/widgets/Carousel'
import {
  CategoryListWidget,
  CollectionShowcase,
  ProductListWidget,
} from '@/components/storefront/widgets/CatalogWidgets'
import { DiscoveryBoxWidget } from '@/components/storefront/widgets/DiscoveryBoxWidget'
import { HeroCta } from '@/components/storefront/widgets/HeroCta'
import {
  ImageWidget,
  PhotoLinkGrid,
  Spacer,
  TextBlock,
} from '@/components/storefront/widgets/SimpleWidgets'
import { PromoBanners } from '@/components/storefront/widgets/PromoBanners'
import { TrustBadgesWidget } from '@/components/storefront/widgets/TrustBadgesWidget'
import { WidgetShell } from '@/components/storefront/widgets/WidgetShell'
import type { Widget, WidgetType } from '@/types/api'

type Renderer = (props: { widget: Widget; priority?: boolean; variant?: BannerVariant }) => React.ReactNode

/**
 * All widget types, one registry.
 */
export const WIDGET_RENDERERS: Record<WidgetType, Renderer> = {
  carousel: Carousel,
  text_block: TextBlock,
  image: ImageWidget,
  product_list: ProductListWidget,
  collection_showcase: CollectionShowcase,
  category_list: CategoryListWidget,
  photo_link_grid: PhotoLinkGrid,
  hero_cta: HeroCta,
  promo_banners: PromoBanners,
  announcement_bar: AnnouncementBar,
  discovery_box: DiscoveryBoxWidget,
  trust_badges: TrustBadgesWidget,
  // Shipping is out of the system and this type never had its own renderer
  // (it borrowed the announcement bar and ignored its own fields).
  free_shipping_bar: () => null,
  // Never had its own renderer either: it drew the samples-box banner.
  gift_wrap_upsell: () => null,
  spacer: Spacer,
  recently_viewed: ProductListWidget,
  buy_again: ProductListWidget,
  recommended_for_you: ProductListWidget,
  trending_near_you: ProductListWidget,
}

export function WidgetRenderer({
  widget,
  priority = false,
  variant,
}: {
  widget: Widget
  priority?: boolean
  /** The builder's preview pins a device; the storefront leaves it to the screen. */
  variant?: BannerVariant
}) {
  const Render = WIDGET_RENDERERS[widget.type]

  // An unknown type means the server has a widget this build does not know
  // about. Rendering nothing is right for a customer; the alternative — the
  // reference's red "نوع أداة غير معروف" box — puts a developer error on the
  // storefront.
  if (!Render) return null

  return (
    <WidgetShell style={widget.style} type={widget.type}>
      <Render widget={widget} priority={priority} variant={variant} />
    </WidgetShell>
  )
}
