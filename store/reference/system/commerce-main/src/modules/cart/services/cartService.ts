import { db } from "@/lib/db/drizzle";
import {
  products,
  productVariants,
  productImages,
  regions,
  orders,
  orderItems,
  walletAccounts,
} from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as cartCache from "@/modules/cache/cart";
import { AddCartItemType } from "../types/cartTypes";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";
import { calculateActiveDeliveryPrice } from "@/modules/delivery/services/deliveryService";

// Insert imports for discounts handling
import { applyDiscounts, CartContext, DiscountApplication } from '@/modules/discounts/services/discountFactory';
import { listDiscounts } from '@/modules/discounts/services/discountService';
import { DiscountType } from '@/modules/discounts/types/discountTypes';

export async function getCartContents(userId: string) {
  let cachedCart = await cartCache.getCart(userId);

  // If the user does not have a cart, create one.
  if (cachedCart === null) {
    const newCart: cartCache.Cart = { items: [], deliveryRegionId: null, deliveryCityId: null, notes: null, paymentMethod: PaymentMethodCode.MANUAL_PAYMENT, address: null };
    await cartCache.setCart(userId, newCart);
    cachedCart = newCart;
  }

  if (cachedCart.items.length === 0) {
    // Update empty cart return to include deliveryDiscountAmount
    return {
      items: [],
      // UI expects subtotal before discounts
      subtotal: 0,
      // Provide discountedSubtotal for clarity/reporting
      discountedSubtotal: 0,
      total: 0,
      deliveryFee: 0,
      deliveryRegionId: cachedCart.deliveryRegionId,
      notes: cachedCart.notes,
      paymentMethod: cachedCart.paymentMethod,
      address: cachedCart.address,
      useWallet: cachedCart.useWallet || false,
      walletBalance: 0,
      walletAmountUsed: 0,
      payableTotal: 0,
      discountTotal: 0,
      deliveryDiscountAmount: 0,
      discountApplications: [] as DiscountApplication[],
    };
  }

  // Separate variant and product items
  const variantItems = cachedCart.items.filter(i => i.variantId) as cartCache.CartItem[];
  const productItems = cachedCart.items.filter(i => !i.variantId) as cartCache.CartItem[];
  let subtotal = 0;
  const items: Array<any> = [];

  // Optimize database calls: fetch variant details, product details, and region in parallel
  const variantIds = variantItems.map(i => i.variantId!);
  const productIds = productItems.map(i => i.productId);

  const [cartProductDetails, productDetails, region] = await Promise.all([
    variantIds.length > 0
      ? db
        .select({
          product: { id: products.id, name: products.name, slug: products.slug },
          variant: { id: productVariants.id, title: productVariants.title, price: productVariants.price, inventoryQuantity: productVariants.inventoryQuantity },
          image: { url: productImages.url },
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .leftJoin(
          productImages,
          and(eq(productImages.variantId, productVariants.id), eq(productImages.sortOrder, 0))
        )
        .where(inArray(productVariants.id, variantIds))
      : Promise.resolve([]),
    productIds.length > 0
      ? db
        .select({ id: products.id, name: products.name, price: products.price, image: productImages.url })
        .from(products)
        .leftJoin(
          productImages,
          and(
            eq(productImages.productId, products.id),
            isNull(productImages.variantId),
            eq(productImages.sortOrder, 0)
          )
        )
        .where(inArray(products.id, productIds))
      : Promise.resolve([]),
    cachedCart.deliveryRegionId
      ? db.query.regions.findFirst({ where: eq(regions.id, cachedCart.deliveryRegionId) })
      : Promise.resolve(null),
  ]);

  // Build maps for constant-time detail lookup
  const variantMap = new Map((cartProductDetails as Array<any>).map(d => [d.variant.id, d]));
  const productMap = new Map((productDetails as Array<any>).map(d => [d.id, d]));

  // Process variant items
  for (const item of variantItems) {
    const detail = variantMap.get(item.variantId!);
    if (!detail) continue;
    const priceNum = parseFloat(detail.variant.price || '0');
    const lineTotal = priceNum * item.quantity;
    subtotal += lineTotal;
    items.push({
      ...item,
      productName: detail.product.name,
      variantTitle: detail.variant.title,
      price: priceNum,
      imageUrl: detail.image?.url,
      lineItemTotal: lineTotal,
      discountAmount: 0,        // placeholder for item discount
      discountId: null,         // applied discount id
    });
  }

  // Process product-only items
  for (const item of productItems) {
    const detail = productMap.get(item.productId);
    if (!detail) continue;
    const priceNum = parseFloat(detail.price || '0');
    const lineTotal = priceNum * item.quantity;
    subtotal += lineTotal;
    items.push({
      variantId: null,
      ...item,
      productName: detail.name,
      variantTitle: null,
      price: priceNum,
      imageUrl: detail.image || null,
      lineItemTotal: lineTotal,
      discountAmount: 0,
      discountId: null,
    });
  }

  // Calculate delivery fee using the active delivery method
  // Only fall back to our own DB prices if no third-party provider is active.
  let deliveryFee = 0;

  // Check if a third-party delivery provider is active
  const { listDeliveryMethodConfigs } = require('@/modules/delivery/services/deliveryService');
  const deliveryConfigs = await listDeliveryMethodConfigs();
  const hasActiveProvider = deliveryConfigs.some((c: any) => c.isActive);

  if (hasActiveProvider) {
    // Third-party provider is active — rely on it exclusively
    if (region) {
      const deliveryResult = await calculateActiveDeliveryPrice(
        (region as any).cityId,
        cachedCart.deliveryRegionId,
        { price: subtotal }
      );
      if (deliveryResult.success) {
        deliveryFee = deliveryResult.price;
      } else {
        console.warn('Active delivery provider returned failure:', deliveryResult.message);
        throw new Error(deliveryResult.message || 'حدث خطأ أثناء حساب تكلفة التوصيل');
      }
    } else if (cachedCart.deliveryCityId) {
      const deliveryResult = await calculateActiveDeliveryPrice(
        cachedCart.deliveryCityId,
        null,
        { price: subtotal }
      );
      if (deliveryResult.success) {
        deliveryFee = deliveryResult.price;
      } else {
        console.warn('Active delivery provider returned failure for city-only:', deliveryResult.message);
        throw new Error(deliveryResult.message || 'حدث خطأ أثناء حساب تكلفة التوصيل');
      }
    }
  } else {
    // No third-party provider active — use our own DB prices (region fee, falling back to city fee)
    if (region) {
      const regionFee = Number((region as any).deliveryFee);
      if (regionFee > 0) {
        deliveryFee = regionFee;
      } else {
        // Inherit from city
        try {
          const cityRecord = await db.query.cities.findFirst({ where: eq(require('@/lib/db/schema').cities.id, (region as any).cityId) });
          if (cityRecord && Number(cityRecord.deliveryFee) > 0) {
            deliveryFee = Number(cityRecord.deliveryFee);
          }
        } catch (_) { /* ignore */ }
      }
    } else if (cachedCart.deliveryCityId) {
      // City selected but no region — use city's delivery fee
      try {
        const cityRecord = await db.query.cities.findFirst({ where: eq(require('@/lib/db/schema').cities.id, cachedCart.deliveryCityId) });
        if (cityRecord && Number(cityRecord.deliveryFee) > 0) {
          deliveryFee = Number(cityRecord.deliveryFee);
        }
      } catch (_) { /* ignore */ }
    }
  }

  // After calculating deliveryFee, attempt to integrate discounts
  let finalItems = items;
  let finalSubtotal = subtotal;
  let finalDeliveryFee = deliveryFee;
  let deliveryDiscountAmount = 0;
  let discountTotal = 0;
  let discountApplications: DiscountApplication[] = [];
  // Preserve original subtotal before discounts for UI display
  const originalSubtotal = subtotal;
  try {
    const allDiscounts = await listDiscounts();
    const now = new Date();
    const activeDiscounts = allDiscounts.filter(d => d.isActive && (!d.startDate || d.startDate <= now) && (!d.endDate || d.endDate >= now));

    let customerSegmentStr = "الكل";
    try {
      if (userId) {
        // Find if user has a segment
        const rfmResult = await db.query.analyticsRfmScores.findFirst({
          where: eq(require('@/lib/db/schema').analyticsRfmScores.userId, userId),
          orderBy: (rfm, { desc }) => [desc(rfm.computedAt)],
        });
        if (rfmResult && rfmResult.segment) {
          customerSegmentStr = rfmResult.segment;
        }
      }
    } catch (e) { /* ignore db error for segment */ }

    const cartContext: CartContext = { items, subtotal, deliveryFee, deliveryDiscountAmount: 0, regionId: cachedCart.deliveryRegionId, customerSegment: customerSegmentStr };
    const { updatedCart, applications } = applyDiscounts(cartContext, activeDiscounts);
    discountApplications = applications;
    discountTotal = applications.reduce((sum, app) => sum + app.discountAmount, 0);
    finalItems = updatedCart.items;
    finalSubtotal = updatedCart.subtotal;
    finalDeliveryFee = updatedCart.deliveryFee;
    deliveryDiscountAmount = updatedCart.deliveryDiscountAmount;
  } catch (err) {
    console.error('Error applying discounts, proceeding without discounts:', err);
  }

  // Calculate total using already-discounted values from applyDiscounts
  // We rely on updatedCart.subtotal and updatedCart.deliveryFee to already include item/order and delivery discounts.
  // deliveryDiscountAmount and discountTotal are returned for reporting purposes.
  const total = finalSubtotal + finalDeliveryFee;

  let walletBalance = 0;
  let walletAmountUsed = 0;

  if (userId) {
    const wallet = await db.query.walletAccounts.findFirst({
      where: and(eq(walletAccounts.userId, userId), eq(walletAccounts.currency, 'LYD'))
    });
    if (wallet) {
      walletBalance = Number(wallet.currentBalance) || 0;
    }
  }

  if (cachedCart.useWallet && walletBalance > 0) {
    walletAmountUsed = Math.min(walletBalance, total);
  }

  const payableTotal = total - walletAmountUsed;

  // Return enriched cart with discounts
  return {
    items: finalItems,
    // UI should show subtotal without discounts
    subtotal: originalSubtotal,
    // Also return discounted subtotal if needed in UI/reporting
    discountedSubtotal: finalSubtotal,
    total,
    payableTotal,
    walletBalance,
    walletAmountUsed,
    useWallet: cachedCart.useWallet || false,
    deliveryFee: finalDeliveryFee,
    deliveryDiscountAmount,
    deliveryRegionId: cachedCart.deliveryRegionId,
    deliveryCityId: cachedCart.deliveryCityId,
    notes: cachedCart.notes,
    paymentMethod: cachedCart.paymentMethod,
    address: cachedCart.address,
    discountTotal,
    discountApplications,
  };
}

export async function addItemToCart(userId: string, item: AddCartItemType) {
  let cartItem: cartCache.CartItem;
  if ('variantId' in item && item.variantId) {
    // Variant item
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, item.variantId),
      columns: { productId: true }
    });
    if (!variant) {
      throw new Error('المتغير غير موجود');
    }
    cartItem = { variantId: item.variantId, productId: variant.productId, quantity: item.quantity };
  } else if ('productId' in item && item.productId) {
    // Product (no variants)
    const product = await db.query.products.findFirst({
      where: eq(products.id, item.productId),
      columns: { hasVariants: true }
    });
    if (!product) {
      throw new Error('المنتج غير موجود');
    }
    if (product.hasVariants) {
      throw new Error('هذا المنتج به متغيرات ولا يمكن إضافته بدون تحديد متغير');
    }
    cartItem = { variantId: null, productId: item.productId, quantity: item.quantity };
  } else {
    throw new Error('بيانات عنصر السلة غير صالحة');
  }

  await cartCache.addItemToCart(userId, cartItem);
}

export async function updateItemQuantity(userId: string, variantId: string, quantity: number) {
  await cartCache.updateCartItemQuantity(userId, variantId, quantity);
}

export async function removeItemFromCart(userId: string, variantId: string) {
  await cartCache.removeCartItem(userId, variantId);
}

export async function clearUserCart(userId: string) {
  await cartCache.clearCart(userId);
}

export async function updateCartDetails(userId: string, details: Partial<Pick<cartCache.Cart, 'deliveryRegionId' | 'deliveryCityId' | 'notes' | 'paymentMethod' | 'address'> & { useWallet?: boolean | null }>) {
  await cartCache.updateCartMetadata(userId, details);
}

// Add createOrderFromCart: create order, insert items, clear cache, cache order id
export async function createOrderFromCart(userId: string): Promise<{ orderId: string; orderNumber: string; fullyPaid: boolean }> {
  // Retrieve current cart details
  const cartData = await getCartContents(userId);
  // Generate a human-readable order number: YEAR + MONTH + paymentCode + random
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const code = cartData.paymentMethod
    ? String(cartData.paymentMethod).slice(0, 3).toUpperCase()
    : 'UNK';
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `${year}${month}${code}${randomPart}`;

  // Insert new order record and return inserted row
  const [orderRecord] = await db.insert(orders)
    .values([{
      userId: userId,
      status: 'pending',
      subtotal: cartData.subtotal.toString(),
      discountTotal: cartData.discountTotal.toString(),
      shippingTotal: cartData.deliveryFee.toString(),
      deliveryDiscountAmount: cartData.deliveryDiscountAmount.toString(),
      total: cartData.total.toString(),
      walletAmountUsed: cartData.walletAmountUsed.toString(),
      // If the payable is 0, the primary payment method technically becomes the wallet.
      paymentMethod: cartData.payableTotal === 0 && cartData.walletAmountUsed > 0 ? "wallet" : cartData.paymentMethod,
      shippingRegionId: cartData.deliveryRegionId,
      shippingCityId: cartData.deliveryCityId,
      shippingAddress: cartData.address ?? null,
      customerNotes: cartData.notes,
      orderNumber: orderNumber,
      discountId: cartData.discountApplications?.[0]?.discount?.id ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }])
    .returning({ id: orders.id });

  // Increment usageCount for all applied discounts
  for (const app of cartData.discountApplications || []) {
    if (app.discount?.id) {
      await db.execute(require('drizzle-orm').sql`UPDATE "discounts" SET "usage_count" = "usage_count" + 1 WHERE "id" = ${app.discount.id}`);
    }
  }
  // Insert order items
  for (const item of cartData.items) {
    await db.insert(orderItems).values([{
      orderId: orderRecord.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.productName,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      price: item.price.toString(),
      discountAmount: item.discountAmount.toString(),
      discountId: item.discountId,
      lineItemTotal: item.lineItemTotal.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
  }

  // Deduct wallet balance immediately to prevent double spending
  if (cartData.walletAmountUsed > 0) {
    const { adjustWalletBalance } = require('@/lib/services/ledger');
    try {
      // Negative amount because we are paying for an order
      await adjustWalletBalance(
        userId,
        -cartData.walletAmountUsed,
        'LYD',
        `Payment for order #${orderNumber}`,
        'system',
        `order_${orderRecord.id}_wallet_payment`
      );
    } catch (e) {
      console.error('Failed to deduct wallet balance during checkout', e);
      throw new Error("حدث خطأ أثناء خصم الرصيد من المحفظة.");
    }
  }

  // Don't clear the cart until payment is confirmed
  // await cartCache.clearCart(userId);
  return { orderId: orderRecord.id, orderNumber, fullyPaid: cartData.payableTotal === 0 && cartData.walletAmountUsed > 0 };
}
