import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import * as cartService from "../../cart/services/cartService";
import { PaymentService } from "../../payments/services/paymentService";
import { PaymentMethodCode, PaymentStatus } from "../../payments/types/paymentTypes";
import { db } from "@/lib/db/drizzle";
import { orders, payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const paymentService = new PaymentService();

// Schema for checkout initiation
const CheckoutInitSchema = z.object({
  paymentMethod: z.string(),
  userInput: z.record(z.any()).optional(),
});

export class CheckoutController {
  // Step 1: Create an order from the cart without clearing it
  static async createOrder(req: NextRequest) {
    try {
      // Get user session
      const authResult = await validateRequest(req);
      if (!authResult.success) {
        return authResult.response;
      }
      const session = authResult.session;

      const userId = session.user.id;

      // Create order from cart but DON'T clear the cart yet
      const { orderId, orderNumber, fullyPaid } = await cartService.createOrderFromCart(userId);

      return NextResponse.json({
        success: true,
        orderId,
        orderNumber,
        fullyPaid
      });
    } catch (error: any) {
      console.error("Error creating order:", error);
      return NextResponse.json(
        { error: error.message || "حدث خطأ أثناء إنشاء الطلب" },
        { status: 500 }
      );
    }
  }

  // Step 2: Initiate payment for an existing order
  static async initiatePayment(req: NextRequest) {
    try {
      // Get user session
      const authResult = await validateRequest(req);
      if (!authResult.success) {
        return authResult.response;
      }
      const session = authResult.session;

      const userId = session.user.id;
      // Safely parse JSON body for payment initiation
      let body;
      try {
        body = await req.json();
      } catch (err: any) {
        console.error("Invalid JSON body for initiatePayment:", err);
        return NextResponse.json(
          { error: "بيانات غير صالحة" },
          { status: 400 }
        );
      }
      const validation = CheckoutInitSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: "بيانات غير صالحة", errors: validation.error.errors },
          { status: 400 }
        );
      }

      const { paymentMethod, userInput } = validation.data;

      // Get orderId from request URL
      const url = new URL(req.url);
      const orderId = url.pathname.split('/').pop();

      if (!orderId) {
        return NextResponse.json(
          { error: "معرف الطلب مفقود" },
          { status: 400 }
        );
      }

      // Lookup order, catch potential DB errors
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(orderId);
      console.log(`Looking up order with identifier ${orderId}, isUuid: ${isUuid}`);
      let orderRecord;
      try {
        orderRecord = await db.query.orders.findFirst({
          where: isUuid ? eq(orders.id, orderId) : eq(orders.orderNumber, orderId)
        });
      } catch (err: any) {
        console.error("DB error querying order:", err);
        return NextResponse.json(
          { error: "حدث خطأ في قاعدة البيانات أثناء جلب الطلب" },
          { status: 500 }
        );
      }
      if (!orderRecord) {
        console.warn(`Order not found for ${orderId}`);
        return NextResponse.json(
          { error: "لم يتم العثور على الطلب" },
          { status: 404 }
        );
      }

      // Make sure this order belongs to the current user
      if (orderRecord.userId !== userId) {
        return NextResponse.json(
          { error: "غير مصرح لك بالوصول إلى هذا الطلب" },
          { status: 403 }
        );
      }

      // Initialize payment amount remaining after wallet
      const totalAmount = parseFloat(orderRecord.total.toString());
      const walletUsed = parseFloat(orderRecord.walletAmountUsed?.toString() || "0");
      const amount = totalAmount - walletUsed;

      if (amount <= 0 && paymentMethod === "wallet") {
        // The order is fully paid by wallet! We don't need a real gateway!
        await db.update(orders)
          .set({ status: 'processing', updatedAt: new Date() })
          .where(eq(orders.id, orderRecord.id));

        // Create a payment record to log this
        const [paymentRecord] = await db.insert(payments).values({
          orderId: orderRecord.id,
          amount: totalAmount.toString(),
          currency: "LYD",
          paymentMethod: "wallet",
          status: PaymentStatus.COMPLETED,
          paymentData: { method: "wallet", date: new Date().toISOString() },
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();

        // Start the delivery workflow directly Since no payment webhook will arrive
        try {
          const items = await db.query.orderItems.findMany({
            where: eq(require('@/lib/db/schema').orderItems.orderId, orderRecord.id),
          });
          const { startActiveDelivery } = require('@/modules/delivery/services/deliveryService');
          const MessageQueue = (await import('@/modules/message_queue')).default;

          await startActiveDelivery({
            orderId: orderRecord.id,
            orderNumber: orderRecord.orderNumber,
            destinationRegionId: orderRecord.shippingRegionId,
            destinationCityId: orderRecord.shippingCityId || undefined,
            address: orderRecord.shippingAddress!,
            paymentMethod: paymentMethod,
            orderTotalPrice: totalAmount - parseFloat(orderRecord.shippingTotal ?? '0'),
            userId: orderRecord.userId || undefined,
            orderItems: items as any, // assuming type alignment
          });

          const itemsToDeduct = items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          }));
          MessageQueue.addJob('inventory', 'reserveStock', { items: itemsToDeduct });
        } catch (e) {
          console.error("Failed to automatically start delivery workflow for wallet-paid order:", e);
        }

        return NextResponse.json({
          success: true,
          paymentId: paymentRecord.id, // using actual paymentId
          redirectUrl: null,
          nextStep: PaymentStatus.COMPLETED,
          message: "تم الدفع بالكامل من المحفظة."
        });
      }

      // Get base URL for return URL prioritizing environment variables and true headers
      let origin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || req.headers.get("origin") || "";

      if (!origin) {
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
        if (host) {
          const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
          origin = `${protocol}://${host}`;
        } else {
          origin = url.origin;
        }
      }

      try {
        const parsed = new URL(origin);
        if (parsed.hostname === 'localhost') {
          parsed.hostname = '127.0.0.1';
          origin = parsed.toString().replace(/\/$/, '');
        }
      } catch (e) {
        console.warn('Failed to normalize origin, using raw origin:', e);
      }

      const returnUrl = `${origin.replace(/\/$/, '')}/checkout/complete?paymentId=`;

      const paymentParams = {
        ...(userInput ?? {}),
        // استخدم نفس الرابط لكل من return و callback لضمان عنوان كامل وصحيح
        returnUrl: returnUrl,
        callbackUrl: returnUrl,
      };
      const result = await paymentService.initiatePayment(
        orderRecord.id,
        amount,
        "LYD", // Assuming currency is Libyan Dinar
        paymentMethod as PaymentMethodCode,
        paymentParams,
        userId
      );
      console.log("Payment initiation result:", result);

      // Surface gateway errors clearly instead of masking them
      if (!result.success) {
        return NextResponse.json({
          success: false,
          paymentId: result.paymentId || null,
          redirectUrl: result.redirectUrl || null,
          lightboxConfig: result.data?.lightboxConfig || null,
          nextStep: result.nextStep || PaymentStatus.FAILED,
          message: result.message || 'فشل في بدء عملية الدفع مع مزود الخدمة.',
          data: result.data || null,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        paymentId: result.paymentId,
        redirectUrl: result.redirectUrl || null,
        lightboxConfig: result.data?.lightboxConfig || null,
        nextStep: result.nextStep || null,
        message: result.message || null,
        data: result.data || null
      });
    } catch (error: any) {
      console.error("Error initiating payment:", error);
      return NextResponse.json(
        { error: error.message || "حدث خطأ أثناء بدء عملية الدفع" },
        { status: 500 }
      );
    }
  }

  // Step 3: Verify payment status
  static async verifyPayment(req: NextRequest) {
    try {
      // Get user session
      const authResult = await validateRequest(req);
      if (!authResult.success) {
        console.warn('CheckoutController.verifyPayment - auth failed');
        return authResult.response;
      }
      const session = authResult.session;

      const userId = session.user.id;

      // Get paymentId from URL
      const url = new URL(req.url);
      const paymentId = url.searchParams.get('paymentId');
      console.log('CheckoutController.verifyPayment - paymentId:', paymentId, 'userId:', userId);

      if (!paymentId) {
        return NextResponse.json(
          { error: "معرف الدفع مفقود" },
          { status: 400 }
        );
      }

      // Get verification data from request body
      const verificationData = await req.json();
      console.log('CheckoutController.verifyPayment - verificationData keys:', Object.keys(verificationData));

      // Find existing payment
      let payment = await db.query.payments.findFirst({
        where: eq(payments.id, paymentId)
      });

      // Fallback: Check if paymentId is actually an orderId (due to cart page bug or specific gateway flows)
      if (!payment) {
        payment = await db.query.payments.findFirst({
          where: eq(payments.orderId, paymentId),
          orderBy: (p, { desc }) => [desc(p.createdAt)]
        });
      }

      if (!payment) {
        console.error('CheckoutController.verifyPayment - payment not found:', paymentId);
        return NextResponse.json(
          { error: "لم يتم العثور على سجل الدفع" },
          { status: 404 }
        );
      }

      console.log('CheckoutController.verifyPayment - payment found:', {
        id: payment.id,
        method: payment.paymentMethod,
        status: payment.status,
        orderId: payment.orderId,
      });

      // If order exists, verify it belongs to current user
      if (payment.orderId) {
        const orderRecord = await db.query.orders.findFirst({
          where: eq(orders.id, payment.orderId)
        });

        if (orderRecord && orderRecord.userId !== userId) {
          console.warn('CheckoutController.verifyPayment - user mismatch:', { orderUser: orderRecord.userId, requestUser: userId });
          return NextResponse.json(
            { error: "غير مصرح لك بالوصول إلى هذا الدفع" },
            { status: 403 }
          );
        }
      }

      // For Moamalat, paymentService expects orderId instead of payment DB id
      const targetPaymentId = payment.paymentMethod === PaymentMethodCode.MOAMALAT && payment.orderId
        ? payment.orderId
        : payment.id;

      // Verify payment
      const result = await paymentService.verifyPayment(
        targetPaymentId,
        payment.paymentMethod as PaymentMethodCode,
        verificationData
      );

      console.log('CheckoutController.verifyPayment - result:', {
        success: result.success,
        status: result.status,
        message: result.message,
      });

      // NOW is the right time to clear the cart (only on successful verification)
      if (result.success) {
        await cartService.clearUserCart(userId);
      }

      return NextResponse.json({
        success: result.success,
        status: result.status,
        message: result.message,
        orderId: payment.orderId,
        orderNumber: result.orderNumber || null
      });
    } catch (error: any) {
      console.error("Error verifying payment:", error);
      return NextResponse.json(
        { error: error.message || "حدث خطأ أثناء التحقق من الدفع" },
        { status: 500 }
      );
    }
  }
}
