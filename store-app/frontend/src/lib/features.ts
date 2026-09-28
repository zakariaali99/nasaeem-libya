/**
 * Storefront features that are switched off without removing their code.
 * Flip a flag to `true` to bring the feature back; nothing else changes.
 *
 * - reviews: product ratings and customer reviews (product page section).
 * - loyalty: loyalty points and VIP tier (cart page badge).
 *
 * Both were put on hold by the owner on 2026-09-28. The backend keeps its
 * endpoints and data; only what the customer sees is hidden.
 */
export const FEATURES = {
  reviews: false,
  loyalty: false,
} as const
