import { AnnouncementBar } from '@/components/storefront/widgets/AnnouncementBar'
import { Carousel } from '@/components/storefront/widgets/Carousel'
import {
  CategoryListWidget,
  CollectionShowcase,
  ProductListWidget,
} from '@/components/storefront/widgets/CatalogWidgets'
import { HeroCta } from '@/components/storefront/widgets/HeroCta'
import {
  ImageWidget,
  PhotoLinkGrid,
  Spacer,
  TextBlock,
} from '@/components/storefront/widgets/SimpleWidgets'
import { WidgetShell } from '@/components/storefront/widgets/WidgetShell'
import type { Widget, WidgetType } from '@/types/api'

type Renderer = (props: { widget: Widget; priority?: boolean }) => React.ReactNode

/**
 * All 14 types, one registry. The four personalised types share
 * `ProductListWidget` because the server has already decided what goes in them —
 * the client difference is only the title, which is in the data.
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
  announcement_bar: AnnouncementBar,
  spacer: Spacer,
  recently_viewed: ProductListWidget,
  buy_again: ProductListWidget,
  recommended_for_you: ProductListWidget,
  trending_near_you: ProductListWidget,
}

export function WidgetRenderer({ widget, priority = false }: { widget: Widget; priority?: boolean }) {
  const Render = WIDGET_RENDERERS[widget.type]

  // An unknown type means the server has a widget this build does not know
  // about. Rendering nothing is right for a customer; the alternative — the
  // reference's red "نوع أداة غير معروف" box — puts a developer error on the
  // storefront.
  if (!Render) return null

  return (
    <WidgetShell style={widget.style} type={widget.type}>
      <Render widget={widget} priority={priority} />
    </WidgetShell>
  )
}
