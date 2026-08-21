import { WidgetDefinition, WidgetType } from "../types/customizationTypes";

export const availableWidgets: Record<WidgetType, WidgetDefinition> = {
  [WidgetType.CAROUSEL]: {
    name: "سلايدر صور",
    defaultSettings: { slides: [], carouselStyle: "hero" },
  },
  [WidgetType.TEXT_BLOCK]: {
    name: "كتلة نصية",
    defaultSettings: { title: "عنوان مبدئي", content: "محتوى مبدئي" },
  },
  [WidgetType.IMAGE]: {
    name: "صورة",
    defaultSettings: { imageUrl: "", altText: "", linkUrl: "" },
  },
  [WidgetType.PRODUCT_LIST]: {
    name: "قائمة منتجات",
    defaultSettings: { title: "منتجاتنا", productIds: [], layout: 'grid' },
  },
  // [WidgetType.PRODUCT_CAROUSEL]: {
  //   name: "سلايدر منتجات",
  //   defaultSettings: { title: "أحدث المنتجات", productIds: [] },
  // },
  [WidgetType.CATEGORY_LIST]: {
    name: "قائمة فئات",
    defaultSettings: { title: "الفئات", categoryIds: [], layout: 'grid' },
  },
  // [WidgetType.CATEGORY_CAROUSEL]: {
  //   name: "سلايدر فئات",
  //   defaultSettings: { title: "تصفح الفئات", categoryIds: [] },
  // },
  [WidgetType.COLLECTION_SHOWCASE]: {
    name: "عرض مجموعة",
    defaultSettings: { collectionId: "", title: "مجموعتنا المميزة", layout: 'grid' },
  },
  [WidgetType.PHOTO_LINK_GRID]: {
    name: "شبكة روابط بالصور",
    defaultSettings: {
      title: "اكتشف المزيد",
      items: [
        { imageUrl: "", name: "عنصر ١", linkUrl: "" },
      ],
    },
  },
  [WidgetType.HERO_CTA]: {
    name: "قسم بطل مع زر",
    defaultSettings: {
      title: "عنوان جذاب",
      subtitle: "وصف موجز يشجع على التفاعل",
      buttonLabel: "اكتشف الآن",
      buttonUrl: "",
      alignment: 'center',
      backgroundImageUrl: "",
    },
  },
  [WidgetType.ANNOUNCEMENT_BAR]: {
    name: "شريط إعلان",
    defaultSettings: {
      message: "تنبيه أو عرض سريع",
      linkLabel: "تعرف أكثر",
      linkUrl: "",
      dismissible: true,
    },
  },
  // [WidgetType.COLLECTION_CAROUSEL]: {
  //   name: "سلايدر مجموعات",
  //   defaultSettings: { title: "المجموعات", collectionIds: [] },
  // },
  //   defaultSettings: { title: "المجموعات", collectionIds: [] },
  // },
  [WidgetType.SPACER]: {
    name: "فاصل مسافة",
    defaultSettings: { height: "md" },
  },
  [WidgetType.RECENTLY_VIEWED]: {
    name: "شوهد مؤخراً",
    defaultSettings: { title: "شاهدته مؤخراً", limit: 8, layout: 'grid' },
  },
  [WidgetType.BUY_AGAIN]: {
    name: "اشترِ مجدداً",
    defaultSettings: { title: "اشترِ مجدداً", limit: 8, layout: 'grid' },
  },
  [WidgetType.RECOMMENDED_FOR_YOU]: {
    name: "مقترح لك",
    defaultSettings: { title: "مقترح لك", limit: 8, layout: 'grid' },
  },
  [WidgetType.TRENDING_NEAR_YOU]: {
    name: "رائج بالقرب منك",
    defaultSettings: { title: "رائج في منطقتك", limit: 8, layout: 'grid' },
  },
};
