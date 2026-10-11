/**
 * Storefront features that are switched off without removing their code.
 * Flip a flag to `true` to bring the feature back; nothing else changes.
 *
 * - reviews: product ratings and customer reviews (product page section).
 * - loyalty: loyalty points and VIP tier (cart page badge).
 *
 * - shipping: the whole shipping module — delivery prices (city/region fees,
 *   the delivery row in totals, the free-delivery promotion) and delivery
 *   companies (courier choice, tracking, waybills, courier settings, COD
 *   reconciliation, courier analytics). Removed from the system by the owner
 *   on 2026-10-10: the store arranges delivery and its price with the customer
 *   directly when it confirms the order. Mirrors `FEATURE_SHIPPING_FEES` in
 *   the backend settings — flip both to bring it back.
 *
 * Reviews and loyalty were put on hold by the owner on 2026-09-28. The backend
 * keeps its endpoints and data; only what the customer sees is hidden.
 */
export const FEATURES = {
  reviews: false,
  loyalty: false,
  shipping: false,
} as const
