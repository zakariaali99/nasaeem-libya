import { getCache, setCache } from "@/modules/cache";
import HomePageClient from "@/components/HomePageClient";
import { listWidgets } from "@/modules/customization/services/customizationService";
import { Widget, WidgetType } from "@/modules/customization/types/customizationTypes";
import { listProducts } from "@/modules/products/services/productService";
import { getCategoryById } from "@/modules/categories/services/categoryService";
import { collectionService } from "@/modules/collections/services/collectionService";
import { resolveUserSegment } from "@/modules/customization/services/segmentResolver";
import { filterWidgetsBySegment } from "@/modules/customization/services/widgetFilter";
import { fetchRecentlyViewed, fetchBuyAgain, fetchRecommendedForYou, fetchTrendingNearYou } from "@/modules/customization/services/personalizedWidgetService";
import { resolveUserRegion } from "@/modules/customization/services/locationResolver";
import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
const getWidgets = async () => {
  try {
    const cacheKey = "home-widgets-v2";
    const cachedWidgets = await getCache<Widget[]>(cacheKey);
    if (cachedWidgets) {
      return cachedWidgets;
    }

    const widgetsResult = await listWidgets({ page: 1, limit: 50 });
    const widgets = widgetsResult.data
      .filter((w) => !!w && w.isActive)
      .map((w) => normalizeWidget(w));

    await setCache(cacheKey, widgets, 3600); // Cache for 1 hour
    return widgets;
  } catch (error) {
    console.error("Failed to fetch widgets:", error);
    return [] as Widget[];
  }
};

export const dynamic = "force-dynamic";


// Ensure widget data is safe/normalized for the client (no Date instances, consistent keys)
function normalizeWidget(w: Widget): Widget {
  const style = w.style ?? undefined;

  // Handle isActive if it's a string "TRUE"/"FALSE" from some DB exports
  let isActive = !!w.isActive;
  if (typeof w.isActive === 'string') {
    isActive = (w.isActive as string).toUpperCase() === 'TRUE';
  }

  const base = {
    id: w.id,
    type: w.type,
    order: typeof w.order === 'number' ? w.order : 0,
    isActive,
    style,
    targeting: w.targeting,
  };

  const d: any = w.data || {};

  // Coerce/normalize data per widget type
  switch (w.type) {
    case WidgetType.IMAGE: {
      const imageUrl = d.imageUrl || d.url || d.image_url || "";
      const altText = d.altText || d.alt || d.alt_text || "";
      return {
        ...base,
        type: WidgetType.IMAGE,
        data: { imageUrl, altText, linkUrl: d.linkUrl || d.link_url },
      } as Widget;
    }
    case WidgetType.CAROUSEL: {
      const slides = Array.isArray(d.slides) ? d.slides : (Array.isArray(d.items) ? d.items : []);
      const safeSlides = slides.map((s: any) => ({
        imageUrl: s?.imageUrl || s?.url || s?.image_url || "",
        linkUrl: s?.linkUrl || s?.link_url,
        title: s?.title,
        subtitle: s?.subtitle,
      }));
      const carouselStyle = (d.carouselStyle || d.carousel_style) === "normal" ? "normal" : "hero";
      return {
        ...base,
        type: WidgetType.CAROUSEL,
        data: { slides: safeSlides, carouselStyle },
      } as Widget;
    }
    case WidgetType.TEXT_BLOCK: {
      return {
        ...base,
        type: WidgetType.TEXT_BLOCK,
        data: { content: d.content || d.text || d.body || "" },
      } as Widget;
    }
    case WidgetType.HERO_CTA: {
      const alignment = d.alignment === "start" || d.alignment === "end" ? d.alignment : "center";
      return {
        ...base,
        type: WidgetType.HERO_CTA,
        data: {
          title: d.title || "",
          subtitle: d.subtitle || "",
          buttonLabel: d.buttonLabel || d.button_label || "",
          buttonUrl: d.buttonUrl || d.button_url || "",
          alignment,
          backgroundImageUrl: d.backgroundImageUrl || d.background_image_url || "",
        },
      } as Widget;
    }
    case WidgetType.ANNOUNCEMENT_BAR: {
      const icon = d.icon && typeof d.icon === "string" ? d.icon : "megaphone";
      return {
        ...base,
        type: WidgetType.ANNOUNCEMENT_BAR,
        data: {
          title: d.title || "تنبيه",
          message: d.message || "",
          linkLabel: d.linkLabel || d.link_label || "",
          linkUrl: d.linkUrl || d.link_url || "",
          dismissible: d.dismissible !== undefined ? !!d.dismissible : true,
          icon,
        },
      } as Widget;
    }
    case WidgetType.PRODUCT_LIST: {
      const layout = (d.layout || d.display_type) === "slider" ? "slider" : "grid";
      const pIds = Array.isArray(d.productIds) ? d.productIds : (Array.isArray(d.product_ids) ? d.product_ids : []);
      return {
        ...base,
        type: WidgetType.PRODUCT_LIST,
        data: {
          title: d.title || d.name || "منتجات مختارة",
          productIds: pIds,
          layout,
        },
      } as Widget;
    }
    case WidgetType.CATEGORY_LIST: {
      const layout = (d.layout || d.display_type) === "slider" ? "slider" : "grid";
      const cIds = Array.isArray(d.categoryIds) ? d.categoryIds : (Array.isArray(d.category_ids) ? d.category_ids : []);
      return {
        ...base,
        type: WidgetType.CATEGORY_LIST,
        data: {
          title: d.title || d.name || "فئات مختارة",
          categoryIds: cIds,
          layout,
        },
      } as Widget;
    }
    case WidgetType.COLLECTION_SHOWCASE: {
      const layout = (d.layout || d.display_type) === "slider" ? "slider" : "grid";
      return {
        ...base,
        type: WidgetType.COLLECTION_SHOWCASE,
        data: { collectionId: d.collectionId || d.collection_id || "", layout },
      } as Widget;
    }
    case WidgetType.PHOTO_LINK_GRID: {
      const items = Array.isArray(d.items) ? d.items : [];
      return {
        ...base,
        type: WidgetType.PHOTO_LINK_GRID,
        data: { title: d.title, items },
      } as Widget;
    }
    case WidgetType.RECENTLY_VIEWED:
    case WidgetType.BUY_AGAIN:
    case WidgetType.RECOMMENDED_FOR_YOU:
    case WidgetType.TRENDING_NEAR_YOU: {
      return {
        ...base,
        type: w.type,
        data: {
          title: d.title || '',
          limit: typeof d.limit === 'number' ? d.limit : 8,
          layout: d.layout === 'slider' ? 'slider' : 'grid',
        },
      } as Widget;
    }
    default: {
      return {
        ...base,
        type: w.type,
        data: d,
      } as Widget;
    }
  }
}


async function populateWidgetsWithData(
  widgets: Widget[],
  userId: string | null = null,
  anonymousId: string | null = null,
  userRegion: string | null = null,
): Promise<Widget[]> {
  const populatedWidgets = await Promise.all(
    widgets.map(async (widget) => {
      try {
        if (widget.type === WidgetType.PRODUCT_LIST) {
          const productIds = widget.data.productIds || [];
          if (productIds.length > 0) {
            const products = await listProducts({ ids: productIds, limit: 50 });
            return { ...widget, fetchedData: products.data };
          }
        } else if (widget.type === WidgetType.CATEGORY_LIST) {
          const categoryIds = widget.data.categoryIds || [];
          if (categoryIds.length > 0) {
            const categories = await Promise.all(
              categoryIds.map(async (id) => {
                const cat = await getCategoryById(id);
                return cat ? { id: cat.id, name: cat.name } : null;
              })
            );
            return { ...widget, fetchedData: categories.filter(c => c !== null) };
          }
        } else if (widget.type === WidgetType.COLLECTION_SHOWCASE) {
          const collectionId = widget.data.collectionId;
          if (collectionId) {
            const [collection, productsRes] = await Promise.all([
              collectionService.getCollectionById(collectionId),
              listProducts({ collectionId, limit: 20 })
            ]);
            if (collection) {
              return {
                ...widget,
                fetchedData: {
                  collection: { name: collection.name },
                  products: productsRes.data
                }
              };
            }
          }
        } else if (widget.type === WidgetType.RECENTLY_VIEWED) {
          const products = await fetchRecentlyViewed(userId, anonymousId, widget.data.limit);
          return { ...widget, fetchedData: products };
        } else if (widget.type === WidgetType.BUY_AGAIN) {
          const products = await fetchBuyAgain(userId, widget.data.limit);
          return { ...widget, fetchedData: products };
        } else if (widget.type === WidgetType.RECOMMENDED_FOR_YOU) {
          const products = await fetchRecommendedForYou(userId, anonymousId, widget.data.limit);
          return { ...widget, fetchedData: products };
        } else if (widget.type === WidgetType.TRENDING_NEAR_YOU) {
          const result = await fetchTrendingNearYou(userRegion, widget.data.limit);
          return { ...widget, fetchedData: result.products, fetchedMeta: { cityName: result.cityName } };
        }
      } catch (e) {
        console.error(`Failed to populate widget ${widget.id} (${widget.type}):`, e);
      }
      return widget;
    })
  );
  return populatedWidgets;
}

export default async function Home() {
  // 1. Fetch all widgets (cached, shared across all users)
  const allWidgets = await getWidgets();

  // 2. Resolve user identity
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const userId = session?.user?.id ?? null;
  const cookieStore = await cookies();
  const anonymousId = cookieStore.get('wave_anonymous_id')?.value ?? null;

  // 3. Resolve RFM segment + region
  const [userSegment, userRegion] = await Promise.all([
    resolveUserSegment(userId),
    resolveUserRegion(userId),
  ]);

  // 4. Filter by targeting rules (segment, auth, time, region)
  const visibleWidgets = filterWidgetsBySegment(allWidgets, {
    isGuest: !userId,
    segment: userSegment,
    region: userRegion,
  });

  // 5. Populate both static widgets and dynamic personalized widgets
  const populatedWidgets = await populateWidgetsWithData(visibleWidgets, userId, anonymousId, userRegion);

  return (
    <div className="flex flex-col">
      <HomePageClient widgets={populatedWidgets} />
    </div>
  );
}
