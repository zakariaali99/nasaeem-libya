import { DiscountWithTargets } from "./discountService";
import { DiscountType } from "../types/discountTypes";

// Cart data context for discount application
export interface CartItemDetail {
  productName: string;
  variantTitle: string | null; // Title of the variant if applicable
  productId: string;
  variantId: string | null;
  quantity: number;
  price: number;
  lineItemTotal: number;
  discountAmount: number;          // per-item discount
  discountId: string | null;       // applied discount id
}

export interface CartContext {
  items: CartItemDetail[];
  subtotal: number;
  deliveryFee: number;
  deliveryDiscountAmount: number; // total delivery discount
  regionId: string | null;
  customerSegment?: string | null;
}

// Result of applying a discount
export interface DiscountApplication {
  discount: DiscountWithTargets;
  discountAmount: number;
}

// Strategy interface for discount appliers
export interface DiscountApplier {
  supports(discount: DiscountWithTargets): boolean;
  apply(cart: CartContext, discount: DiscountWithTargets): DiscountApplication | null;
}

// Fixed amount off order-wide
class FixedDiscountApplier implements DiscountApplier {
  supports(discount: DiscountWithTargets): boolean {
    return discount.type === DiscountType.FIXED && (!discount.productIds.length && !discount.variantIds.length);
  }
  apply(cart: CartContext, discount: DiscountWithTargets): DiscountApplication | null {
    if (!discount.value) return null;
    // respect min order amount
    if (discount.minOrderAmount && cart.subtotal < discount.minOrderAmount) return null;
    const amount = Math.min(discount.value, cart.subtotal);
    return { discount, discountAmount: amount };
  }
}

// Percentage off order-wide
class PercentageDiscountApplier implements DiscountApplier {
  supports(discount: DiscountWithTargets): boolean {
    return discount.type === DiscountType.PERCENTAGE && (!discount.productIds.length && !discount.variantIds.length);
  }
  apply(cart: CartContext, discount: DiscountWithTargets): DiscountApplication | null {
    if (!discount.percentage) return null;
    if (discount.minOrderAmount && cart.subtotal < discount.minOrderAmount) return null;
    const amount = (discount.percentage / 100) * cart.subtotal;
    if (discount.maxDiscountAmount) {
      return { discount, discountAmount: Math.min(amount, discount.maxDiscountAmount) };
    }
    return { discount, discountAmount: amount };
  }
}

// BOGO (Buy X Get Y Free) discount applier
class BogoDiscountApplier implements DiscountApplier {
  supports(discount: DiscountWithTargets): boolean {
    return discount.type === DiscountType.BOGO && !!discount.bogo;
  }
  apply(cart: CartContext, discount: DiscountWithTargets): DiscountApplication | null {
    if (!discount.bogo) return null;
    let totalFreeValue = 0;
    const { buy, get } = discount.bogo;
    for (const item of cart.items) {
      const appliesToProduct = discount.productIds.includes(item.productId);
      const appliesToVariant = item.variantId ? discount.variantIds.includes(item.variantId) : false;
      if (appliesToProduct || appliesToVariant) {
        const groups = Math.floor(item.quantity / buy);
        const freeCount = groups * get;
        const discountAmt = freeCount * item.price;
        if (discountAmt > 0) {
          item.discountAmount += discountAmt;
          item.discountId = discount.id ?? null;
          totalFreeValue += discountAmt;
        }
      }
    }
    return totalFreeValue > 0 ? { discount, discountAmount: totalFreeValue } : null;
  }
}

// Tiered discount applier (order-wide percent tiers)
class TieredDiscountApplier implements DiscountApplier {
  supports(discount: DiscountWithTargets): boolean {
    return discount.type === DiscountType.TIERED && Array.isArray(discount.tiered) && discount.tiered.length > 0;
  }
  apply(cart: CartContext, discount: DiscountWithTargets): DiscountApplication | null {
    if (!discount.tiered) return null;
    // Determine total quantity across cart
    const totalQty = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    // Find highest applicable tier
    const sorted = [...discount.tiered].sort((a, b) => a.minQty - b.minQty);
    let applicable: { minQty: number; discount: number } | null = null;
    for (const tier of sorted) {
      if (totalQty >= tier.minQty) applicable = tier;
    }
    if (!applicable) return null;
    // Treat tier.discount as percentage
    const amount = (applicable.discount / 100) * cart.subtotal;
    return { discount, discountAmount: discount.maxDiscountAmount ? Math.min(amount, discount.maxDiscountAmount) : amount };
  }
}

// Delivery fee discount applier
class DeliveryDiscountApplier implements DiscountApplier {
  supports(discount: DiscountWithTargets): boolean {
    return discount.type === DiscountType.DELIVERY && discount.deliveryDiscount != null;
  }
  apply(cart: CartContext, discount: DiscountWithTargets): DiscountApplication | null {
    const delDisc = discount.deliveryDiscount ?? 0;
    if (delDisc <= 0) return null;
    const amount = Math.min(delDisc, cart.deliveryFee);
    if (amount <= 0) return null;
    cart.deliveryDiscountAmount += amount;
    cart.deliveryFee -= amount;
    return { discount, discountAmount: amount };
  }
}

// Product-specific fixed amount off discount
class ProductFixedDiscountApplier implements DiscountApplier {
  supports(discount: DiscountWithTargets): boolean {
    return discount.type === DiscountType.FIXED && (discount.productIds.length > 0 || discount.variantIds.length > 0);
  }
  apply(cart: CartContext, discount: DiscountWithTargets): DiscountApplication | null {
    if (!discount.value) return null;
    let totalDiscount = 0;
    for (const item of cart.items) {
      const appliesToProduct = discount.productIds.includes(item.productId);
      const appliesToVariant = item.variantId ? discount.variantIds.includes(item.variantId) : false;
      if (appliesToProduct || appliesToVariant) {
        const amt = Math.min(discount.value, item.lineItemTotal);
        item.discountAmount += amt;
        item.discountId = discount.id ?? null;
        totalDiscount += amt;
      }
    }
    return totalDiscount > 0 ? { discount, discountAmount: totalDiscount } : null;
  }
}

// Product-specific percentage off discount
class ProductPercentageDiscountApplier implements DiscountApplier {
  supports(discount: DiscountWithTargets): boolean {
    return discount.type === DiscountType.PERCENTAGE && (discount.productIds.length > 0 || discount.variantIds.length > 0);
  }
  apply(cart: CartContext, discount: DiscountWithTargets): DiscountApplication | null {
    if (!discount.percentage) return null;
    let totalDiscount = 0;
    for (const item of cart.items) {
      const appliesToProduct = discount.productIds.includes(item.productId);
      const appliesToVariant = item.variantId ? discount.variantIds.includes(item.variantId) : false;
      if (appliesToProduct || appliesToVariant) {
        const amt = (discount.percentage / 100) * item.lineItemTotal;
        item.discountAmount += amt;
        item.discountId = discount.id ?? null;
        totalDiscount += amt;
      }
    }
    if (discount.maxDiscountAmount) {
      totalDiscount = Math.min(totalDiscount, discount.maxDiscountAmount);
    }
    return totalDiscount > 0 ? { discount, discountAmount: totalDiscount } : null;
  }
}

// Registry of appliers
const appliers: DiscountApplier[] = [
  new ProductFixedDiscountApplier(),
  new ProductPercentageDiscountApplier(),
  new BogoDiscountApplier(),
  new TieredDiscountApplier(),
  new DeliveryDiscountApplier(),
  // add future appliers here
];

// Apply all discount strategies sequentially
export function applyDiscounts(
  cart: CartContext,
  discounts: DiscountWithTargets[]
): { updatedCart: CartContext; applications: DiscountApplication[] } {
  const applications: DiscountApplication[] = [];
  let updatedCart = { ...cart };
  for (const discount of discounts) {
    // Check usage limits if usageCount and usageLimit are set
    if (discount.usageLimit !== null && discount.usageLimit !== undefined && discount.usageCount != null && discount.usageCount >= discount.usageLimit) {
      continue;
    }

    // Check customer segments
    if (discount.customerSegment) {
      const allowedSegment = discount.customerSegment.trim();
      const userSegment = (cart.customerSegment || "الكل").trim();

      // If the discount requires a specific segment and the user doesn't match it (and it isn't "الكل" which means all)
      if (allowedSegment !== "الكل" && allowedSegment !== userSegment) {
        continue;
      }
    }

    for (const applier of appliers) {
      if (applier.supports(discount)) {
        const result = applier.apply(updatedCart, discount);
        if (result) {
          applications.push(result);
          updatedCart.subtotal -= result.discountAmount;
          break; // do not apply same discount multiple times
        }
      }
    }
  }
  return { updatedCart, applications };
}
