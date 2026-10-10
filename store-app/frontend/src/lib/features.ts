/**
 * Storefront features that are switched off without removing their code.
 * Flip a flag to `true` to bring the feature back; nothing else changes.
 *
 * - reviews: product ratings and customer reviews (product page section).
 * - loyalty: loyalty points and VIP tier (cart page badge).
 *
 * - shippingFees: charging the dashboard's city/region delivery fees. Off since
 *   2026-10-10: the store quotes delivery to the customer when it confirms the
 *   order, so the storefront shows `SHIPPING_QUOTE_NOTE` instead of a price.
 *   Mirrors `FEATURE_SHIPPING_FEES` in the backend settings — flip both.
 *
 * Reviews and loyalty were put on hold by the owner on 2026-09-28. The backend
 * keeps its endpoints and data; only what the customer sees is hidden.
 */
export const FEATURES = {
  reviews: false,
  loyalty: false,
  shippingFees: false,
} as const

/** What the customer reads wherever a delivery price used to be. */
export const SHIPPING_QUOTE_SHORT = 'يُحدَّد عند تأكيد الطلب'
export const SHIPPING_QUOTE_NOTE =
  'سعر التوصيل غير مُضاف إلى الإجمالي: سنتواصل معك مباشرة لتأكيد الطلب وإبلاغك بسعر التوصيل إلى مدينتك.'
