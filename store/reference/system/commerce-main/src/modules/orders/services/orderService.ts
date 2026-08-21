import { db } from '@/lib/db/drizzle';
import { orders, orderItems, productImages, payments, products, productVariants } from '@/lib/db/schema';
import { user as userTable } from '@/lib/db/auth-schema';
import { eq, or } from 'drizzle-orm';
import { count, desc } from 'drizzle-orm';
import {
  PaginationParams,
  PaginatedOrdersResult,
  Order,
  OrderItem,
  OrderStatus,
  UpdateOrderStatusInput,
  updateOrderStatusSchema,
} from '../types/orderTypes';
import MessageQueue from '@/modules/message_queue';

// Helper to count total orders with optional user filter
async function getTotalOrderCount(userId?: string): Promise<number> {
  const whereCondition = userId ? eq(orders.userId, userId) : undefined;
  const result = await db.select({ count: count() }).from(orders).where(whereCondition);
  return result[0]?.count ?? 0;
}

// List orders for a specific user (pagination)
export async function listOrdersForUser(
  userId: string,
  params: PaginationParams = {}
): Promise<PaginatedOrdersResult> {
  // List orders for user includes userName for admin view
  const { page = 1, limit = 10 } = params;
  const offset = (page - 1) * limit;
  const whereCondition = eq(orders.userId, userId);

  const dbOrders = await db
    .select()
    .from(orders)
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(orders.createdAt));

  const total = await getTotalOrderCount(userId);

  // Fetch items and userName for each order
  const data: Order[] = await Promise.all(
    dbOrders.map(async (o) => {
      // fetch user name
      const userRaw = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, o.userId as string))
        .limit(1);
      const userName = userRaw[0]?.name;
      const itemsRaw = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, o.id));
      // enrich items with imageUrl
      const items: OrderItem[] = await Promise.all(
        itemsRaw.map(async (it) => {
          const imgs = await db
            .select({ url: productImages.url })
            .from(productImages)
            .where(
              it.variantId
                ? eq(productImages.variantId, it.variantId)
                : eq(productImages.productId, it.productId)
            )
            .orderBy(productImages.sortOrder)
            .limit(1);
          // fetch product name
          const prod = await db
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, it.productId))
            .limit(1);
          const productName = prod[0]?.name ?? '';
          // fetch variant title if present
          let variantTitle: string | undefined = undefined;
          if (it.variantId) {
            const varRow = await db
              .select({ title: productVariants.title })
              .from(productVariants)
              .where(eq(productVariants.id, it.variantId))
              .limit(1);
            variantTitle = varRow[0]?.title ?? undefined;
          }
          // construct OrderItem explicitly
          return {
            id: it.id,
            orderId: it.orderId,
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
            price: it.price.toString(),
            imageUrl: imgs[0]?.url,
            productName,
            variantTitle,
          };
        })
      );
      // fetch associated payment
      const payRaw = await db.select().from(payments).where(eq(payments.orderId, o.id)).limit(1);
      const pay = payRaw[0];
      const payment = pay
        ? {
          id: pay.id,
          paymentMethod: pay.paymentMethod,
          amount: pay.amount.toString(),
          currency: pay.currency,
          status: pay.status,
          transactionId: pay.transactionId || undefined,
          paymentData: pay.paymentData || undefined,
          createdAt: pay.createdAt,
          updatedAt: pay.updatedAt,
        }
        : undefined;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        userId: o.userId ?? '',
        userName,
        items,
        total: o.total.toString(),
        status: o.status as OrderStatus,
        shippingStatus: o.shippingStatus as string,
        payment,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    })
  );

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// List all orders (admin) with pagination
export async function listAllOrders(
  params: PaginationParams = {}
): Promise<PaginatedOrdersResult> {
  const { page = 1, limit = 10 } = params;
  const offset = (page - 1) * limit;

  const dbOrders = await db
    .select()
    .from(orders)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(orders.createdAt));

  const total = await getTotalOrderCount();

  const data: Order[] = await Promise.all(
    dbOrders.map(async (o) => {
      // fetch user name
      const userRaw = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, o.userId!))
        .limit(1);
      const userName = userRaw[0]?.name;
      const itemsRaw = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, o.id));
      // enrich items with imageUrl
      const items: OrderItem[] = await Promise.all(
        itemsRaw.map(async (it) => {
          const imgs = await db
            .select({ url: productImages.url })
            .from(productImages)
            .where(
              it.variantId
                ? eq(productImages.variantId, it.variantId)
                : eq(productImages.productId, it.productId)
            )
            .orderBy(productImages.sortOrder)
            .limit(1);
          // fetch product name
          const prod = await db
            .select({ name: products.name })
            .from(products)
            .where(eq(products.id, it.productId))
            .limit(1);
          const productName = prod[0]?.name ?? '';
          // fetch variant title if any
          let variantTitle: string | undefined = undefined;
          if (it.variantId) {
            const varRow = await db
              .select({ title: productVariants.title })
              .from(productVariants)
              .where(eq(productVariants.id, it.variantId))
              .limit(1);
            variantTitle = varRow[0]?.title ?? undefined;
          }
          return {
            ...it,
            imageUrl: imgs[0]?.url,
            productName,
            variantTitle,
          };
        })
      );
      const payRaw = await db.select().from(payments).where(eq(payments.orderId, o.id)).limit(1);
      const pay = payRaw[0];
      const payment = pay
        ? {
          id: pay.id,
          paymentMethod: pay.paymentMethod,
          amount: pay.amount.toString(),
          currency: pay.currency,
          status: pay.status,
          transactionId: pay.transactionId || undefined,
          paymentData: pay.paymentData || undefined,
          createdAt: pay.createdAt,
          updatedAt: pay.updatedAt,
        }
        : undefined;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        userId: o.userId ?? '',
        userName,
        items,
        total: o.total.toString(),
        status: o.status as OrderStatus,
        shippingStatus: o.shippingStatus as string,
        payment,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    })
  );

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Get single order by ID, including items
export async function getOrderById(
  orderIdOrNumber: string
): Promise<Order | undefined> {
  // Query by ID or order number
  const result = await db
    .select()
    .from(orders)
    .where(
      or(
        eq(orders.id, orderIdOrNumber),
        eq(orders.orderNumber, orderIdOrNumber)
      )
    )
    .limit(1);
  const o = result[0];
  if (!o) return undefined;
  // fetch user name
  const userRaw = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, o.userId!))
    .limit(1);
  const userName = userRaw[0]?.name;
  const itemsRaw = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, o.id));
  // enrich items with imageUrl
  const items: OrderItem[] = await Promise.all(
    itemsRaw.map(async (it) => {
      const imgs = await db
        .select({ url: productImages.url })
        .from(productImages)
        .where(
          it.variantId
            ? eq(productImages.variantId, it.variantId)
            : eq(productImages.productId, it.productId)
        )
        .orderBy(productImages.sortOrder)
        .limit(1);
      // fetch product name
      const prod = await db
        .select({ name: products.name })
        .from(products)
        .where(eq(products.id, it.productId))
        .limit(1);
      const productName = prod[0]?.name ?? '';
      // fetch variant title if any
      let variantTitle: string | undefined = undefined;
      if (it.variantId) {
        const varRow = await db
          .select({ title: productVariants.title })
          .from(productVariants)
          .where(eq(productVariants.id, it.variantId))
          .limit(1);
        variantTitle = varRow[0]?.title ?? undefined;
      }
      // construct OrderItem explicitly
      return {
        id: it.id,
        orderId: it.orderId,
        productId: it.productId,
        variantId: it.variantId,
        quantity: it.quantity,
        price: it.price.toString(),
        imageUrl: imgs[0]?.url,
        productName,
        variantTitle,
      };
    })
  );
  // fetch associated payment
  const payRaw = await db.select().from(payments).where(eq(payments.orderId, o.id)).limit(1);
  const pay = payRaw[0];
  const payment = pay
    ? {
      id: pay.id,
      paymentMethod: pay.paymentMethod,
      amount: pay.amount.toString(),
      currency: pay.currency,
      status: pay.status,
      transactionId: pay.transactionId || undefined,
      paymentData: pay.paymentData || undefined,
      createdAt: pay.createdAt,
      updatedAt: pay.updatedAt,
    }
    : undefined;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    userId: o.userId ?? '',
    userName,
    items,
    total: o.total.toString(),
    walletAmountUsed: o.walletAmountUsed?.toString() || "0",
    status: o.status as OrderStatus,
    shippingStatus: o.shippingStatus as string,
    payment,
    trackingNumber: o.trackingNumber || undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// Update order status (admin)
export async function updateOrderStatus(
  orderId: string,
  inputData: unknown
): Promise<Order | undefined> {
  const validated = updateOrderStatusSchema.parse(inputData) as UpdateOrderStatusInput;
  const setPayload: any = {};
  if (validated.status) setPayload.status = validated.status;
  if (validated.shippingStatus) setPayload.shippingStatus = validated.shippingStatus;

  // Only update order if there are order fields to update
  let oldOrder: typeof orders.$inferSelect | null = null;
  if (Object.keys(setPayload).length > 0) {
    const originalOrders = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    oldOrder = originalOrders[0];
    const result = await db
      .update(orders)
      .set(setPayload)
      .where(eq(orders.id, orderId))
      .returning();
    if (result.length === 0) return undefined;
  }

  // Handle inventory reservations based on status changes
  if (oldOrder) {
    if (setPayload.shippingStatus === 'delivered' && oldOrder.shippingStatus !== 'delivered') {
      const itemsRaw = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const itemsToUpdate = itemsRaw.map(it => ({
        productId: it.productId,
        variantId: it.variantId,
        quantity: it.quantity
      }));
      MessageQueue.addJob('inventory', 'deliverStock', { items: itemsToUpdate });
    } else if (setPayload.status && ['cancelled', 'refunded', 'returned'].includes(setPayload.status) && oldOrder.status !== setPayload.status) {
      // Only cancel reservation if it was previously processing/shipped (i.e. reserved) and not already delivered
      if (oldOrder.status !== 'pending' && oldOrder.shippingStatus !== 'delivered') {
        const itemsRaw = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
        const itemsToUpdate = itemsRaw.map(it => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity
        }));
        MessageQueue.addJob('inventory', 'cancelReservation', { items: itemsToUpdate });
      }
    }
  }

  // Update payment status if provided
  if (validated.paymentStatus) {
    await db.update(payments).set({ status: validated.paymentStatus }).where(eq(payments.orderId, orderId));
  }

  // Return updated order with userName
  return getOrderById(orderId);
}
