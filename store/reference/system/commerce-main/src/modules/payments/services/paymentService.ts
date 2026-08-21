import { db } from "@/lib/db/drizzle";
import { payments, paymentMethodConfigurations, orders, regions, orderItems } from "@/lib/db/schema";
import { eq, and, or, sql, asc, desc, AnyColumn } from "drizzle-orm";
import {
  PaymentMethod,
  PaymentStatus,
  PaymentMethodCode,
  PaymentMethodConfiguration,
  BasePaymentData,
  BinancePayPaymentData,
  ManualPaymentData
} from "../types/paymentTypes";
import { createBinancePayMethod } from "../factories/binancePayFactory";
import { createManualPaymentMethod } from "../factories/manualPaymentFactory";
import { createBankCardsOnDeliveryMethod } from "../factories/bankCardsOnDeliveryFactory";
import { createSadadPayMethod } from "../factories/sadadPayFactory";
import { createMoamalatMethod } from "../factories/moamalatFactory";
import { createPlutuMethod } from "../factories/plutuFactory";
import type { DeliveryOrderItem } from "@/modules/delivery/types/deliveryTypes";

const plutuSubMethodMap: Partial<Record<PaymentMethodCode, { channel: "sadad" | "edfali" | "mpgs" | "tlync" | "local_cards" }>> = {
  [PaymentMethodCode.PLUTU_SADAD]: { channel: "sadad" },
  [PaymentMethodCode.PLUTU_EDFALI]: { channel: "edfali" },
  [PaymentMethodCode.PLUTU_MPGS]: { channel: "mpgs" },
  [PaymentMethodCode.PLUTU_TLYNC]: { channel: "tlync" },
  [PaymentMethodCode.PLUTU_LOCAL_CARDS]: { channel: "local_cards" },
};

function isPlutuSubMethod(code: PaymentMethodCode): boolean {
  return Boolean(plutuSubMethodMap[code]);
}
import { startActiveDelivery } from "@/modules/delivery/services/deliveryService";
import MessageQueue from '@/modules/message_queue';
import { user } from "@/lib/db/auth-schema";

export const registeredPaymentMethods: Map<PaymentMethodCode, PaymentMethod> = new Map();

export class PaymentService {
  async getAvailablePaymentMethods(): Promise<(Omit<PaymentMethodConfiguration, 'configData'> & { metadata?: Record<string, any> })[]> {
    try {
      const configsFromDb = await db.query.paymentMethodConfigurations.findMany({
        where: eq(paymentMethodConfigurations.isEnabled, true),
        orderBy: paymentMethodConfigurations.sortOrder,
      });

      const expanded: Array<Omit<PaymentMethodConfiguration, 'configData'> & { metadata?: Record<string, any> }> = [];

      for (const config of configsFromDb) {
        const baseConfig = {
          id: config.id,
          methodCode: config.methodCode as PaymentMethodCode,
          displayName: config.displayName,
          description: config.description,
          isEnabled: config.isEnabled,
          sortOrder: config.sortOrder,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        };

        // Add method-specific metadata without exposing sensitive config
        let metadata: Record<string, any> = {};

        if (config.methodCode === PaymentMethodCode.MOAMALAT) {
          const configData = typeof config.configData === 'string' ? JSON.parse(config.configData) : config.configData;
          const sandboxMode = configData?.sandboxMode ?? true; // Default to sandbox for safety
          metadata = {
            scriptUrl: sandboxMode
              ? 'https://tnpg.moamalat.net:6006/js/lightbox.js'
              : 'https://npg.moamalat.net:6006/js/lightbox.js',
            sandboxMode: sandboxMode
          };
          expanded.push({ ...baseConfig, metadata });
          continue;
        }

        if (config.methodCode === PaymentMethodCode.PLUTU) {
          const configData = typeof config.configData === 'string' ? JSON.parse(config.configData) : config.configData;
          const channels = {
            sadad: !!configData?.enableSadadApi,
            edfali: !!configData?.enableEdFali,
            mpgs: !!configData?.enableMpgs,
            tlync: !!configData?.enableTlync,
            local_cards: !!configData?.enableLocalCards,
          };

          const baseMeta = { sandboxMode: !!configData?.sandboxMode };

          // Expand each enabled channel into its own public payment method entry
          if (channels.sadad) {
            expanded.push({
              ...baseConfig,
              id: `${config.id}-sadad`,
              methodCode: PaymentMethodCode.PLUTU_SADAD,
              displayName: "سداد (عبر بلوتو)",
              description: "دفع عبر سداد API من خلال بوابة بلوتو.",
              metadata: { ...baseMeta, channel: "sadad" },
            });
          }
          if (channels.edfali) {
            expanded.push({
              ...baseConfig,
              id: `${config.id}-edfali`,
              methodCode: PaymentMethodCode.PLUTU_EDFALI,
              displayName: "إدفعلي (عبر بلوتو)",
              description: "دفع عبر إدفعلي من خلال بوابة بلوتو.",
              metadata: { ...baseMeta, channel: "edfali" },
            });
          }
          if (channels.mpgs) {
            expanded.push({
              ...baseConfig,
              id: `${config.id}-mpgs`,
              methodCode: PaymentMethodCode.PLUTU_MPGS,
              displayName: "MPGS (عبر بلوتو)",
              description: "دفع عبر MPGS من خلال بوابة بلوتو.",
              metadata: { ...baseMeta, channel: "mpgs" },
            });
          }
          if (channels.tlync) {
            expanded.push({
              ...baseConfig,
              id: `${config.id}-tlync`,
              methodCode: PaymentMethodCode.PLUTU_TLYNC,
              displayName: "Tlync (عبر بلوتو)",
              description: "دفع عبر Tlync من خلال بوابة بلوتو.",
              metadata: { ...baseMeta, channel: "tlync" },
            });
          }
          if (channels.local_cards) {
            expanded.push({
              ...baseConfig,
              id: `${config.id}-localcards`,
              methodCode: PaymentMethodCode.PLUTU_LOCAL_CARDS,
              displayName: "بطاقات محلية (عبر بلوتو)",
              description: "دفع بالبطاقات المحلية عبر بوابة بلوتو.",
              metadata: { ...baseMeta, channel: "local_cards" },
            });
          }
          continue;
        }

        // Default push for non-Plutu methods
        expanded.push({
          ...baseConfig,
          ...(Object.keys(metadata).length > 0 && { metadata })
        });
      }

      return expanded;
    } catch (error) {
      console.error("Error fetching available payment methods:", error);
      throw new Error("حدث خطأ أثناء جلب طرق الدفع المتاحة.");
    }
  }

  private async getPaymentMethodInstance(methodCode: PaymentMethodCode): Promise<PaymentMethod | null> {
    let method: PaymentMethod | undefined = registeredPaymentMethods.get(methodCode);
    if (!method) {
      // Attempt to dynamically initialize if not found (e.g. if config was added after initial load)
      console.warn(`Payment method ${methodCode} not found in cache, attempting dynamic load.`);
      const targetCode = isPlutuSubMethod(methodCode) ? PaymentMethodCode.PLUTU : methodCode;
      const config = await db.query.paymentMethodConfigurations.findFirst({
        where: and(eq(paymentMethodConfigurations.methodCode, targetCode), eq(paymentMethodConfigurations.isEnabled, true))
      });
      if (config) {
        const parsedConfigData = typeof config.configData === 'string' ? JSON.parse(config.configData) : config.configData;
        const channelInfo = plutuSubMethodMap[methodCode];
        switch (methodCode) {
          case PaymentMethodCode.BINANCE_PAY: method = createBinancePayMethod(parsedConfigData); break;
          case PaymentMethodCode.MANUAL_PAYMENT: method = createManualPaymentMethod(parsedConfigData); break;
          case PaymentMethodCode.BANK_CARDS_ON_DELIVERY: method = createBankCardsOnDeliveryMethod(parsedConfigData); break;
          case PaymentMethodCode.SADAD_PAY: method = createSadadPayMethod(parsedConfigData); break;
          case PaymentMethodCode.MOAMALAT: method = createMoamalatMethod(parsedConfigData); break;
          case PaymentMethodCode.PLUTU: break; // base Plutu not exposed directly
          case PaymentMethodCode.PLUTU_SADAD:
          case PaymentMethodCode.PLUTU_EDFALI:
          case PaymentMethodCode.PLUTU_MPGS:
          case PaymentMethodCode.PLUTU_TLYNC:
          case PaymentMethodCode.PLUTU_LOCAL_CARDS:
            if (channelInfo) {
              method = createPlutuMethod(parsedConfigData, channelInfo.channel);
            }
            break;
        }
        if (method) {
          registeredPaymentMethods.set(methodCode as PaymentMethodCode, { ...method, isEnabled: config.isEnabled });
        } else {
          console.error(`Failed to dynamically load payment method: ${methodCode}`);
          return null;
        }
      } else {
        console.error(`No enabled configuration found for payment method: ${methodCode}`);
        return null;
      }
    }
    return method && method.isEnabled ? method : null;
  }

  private async getMethodConfigData(methodCode: PaymentMethodCode): Promise<Record<string, any> | null> {
    const targetCode = isPlutuSubMethod(methodCode) ? PaymentMethodCode.PLUTU : methodCode;
    const config = await db.query.paymentMethodConfigurations.findFirst({
      where: eq(paymentMethodConfigurations.methodCode, targetCode),
    });
    if (!config) return null;
    // Ensure the configData is cast to the expected return type
    return (typeof config.configData === 'string' ? JSON.parse(config.configData) : config.configData) as Record<string, any>;
  }

  private async startDeliveryWorkflow(
    orderRecord: typeof orders.$inferSelect,
    paymentMethod: PaymentMethodCode,
    options?: {
      orderItems?: typeof orderItems.$inferSelect[];
      enqueueInventory?: boolean;
      reason?: string;
    }
  ): Promise<void> {
    if (!orderRecord) return;

    const items = options?.orderItems ?? await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderRecord.id),
    });

    try {
      await startActiveDelivery({
        orderId: orderRecord.id,
        orderNumber: orderRecord.orderNumber,
        destinationRegionId: orderRecord.shippingRegionId,
        destinationCityId: orderRecord.shippingCityId || undefined,
        address: orderRecord.shippingAddress!,
        paymentMethod,
        orderTotalPrice: parseFloat(orderRecord.total.toString()) - parseFloat(orderRecord.shippingTotal ?? '0'),
        userId: orderRecord.userId || undefined,
        orderItems: items as DeliveryOrderItem[],
      });
    } catch (err) {
      const reason = options?.reason ? ` (${options.reason})` : '';
      console.error(`Error starting delivery${reason}:`, err);
    }

    if (options?.enqueueInventory === false) return;

    try {
      const itemsToDeduct = items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }));
      MessageQueue.addJob('inventory', 'reserveStock', { items: itemsToDeduct });
    } catch (dqErr) {
      console.error('Failed to enqueue inventory deduction job:', dqErr);
    }
  }

  async initiatePayment(
    orderId: string,
    amount: number,
    currency: string,
    methodCode: PaymentMethodCode,
    userInput?: Record<string, any>,
    userId?: string,
  ): Promise<any> {
    const method = await this.getPaymentMethodInstance(methodCode);
    if (!method) {
      throw new Error("طريقة الدفع غير صالحة أو غير مفعلة.");
    }
    const configData = await this.getMethodConfigData(methodCode);
    if (!configData) {
      throw new Error("لم يتم العثور على إعدادات طريقة الدفع.");
    }

    // Extract returnUrl if provided in userInput
    let returnUrl = userInput?.returnUrl;
    const paymentUserInput = { ...userInput };

    // Don't pass returnUrl through userInput to the payment method
    if (returnUrl) {
      delete paymentUserInput.returnUrl;
    }

    const channelInfo = plutuSubMethodMap[methodCode];
    const isPlutuRedirectChannel = Boolean(channelInfo && (channelInfo.channel === 'mpgs' || channelInfo.channel === 'tlync' || channelInfo.channel === 'local_cards'));
    let preCreatedPaymentId: string | null = null;
    let orderRecordForPlutu: typeof orders.$inferSelect | null = null;

    // For Plutu redirect channels, create a pending payment record before calling the gateway so we can embed paymentId in return_url
    if (isPlutuRedirectChannel) {
      orderRecordForPlutu = (await db.query.orders.findFirst({ where: eq(orders.id, orderId) })) || null;
      if (!orderRecordForPlutu) throw new Error("لم يتم العثور على الطلب.");

      const newPayment = await db.insert(payments).values({
        orderId: orderRecordForPlutu.id,
        paymentMethod: methodCode,
        amount: amount.toString(),
        currency,
        status: PaymentStatus.PENDING,
        paymentData: { initiatedAt: new Date().toISOString() } as BasePaymentData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      preCreatedPaymentId = newPayment[0].id;

      // Append paymentId to returnUrl so Plutu redirects back with context
      if (returnUrl) {
        paymentUserInput.returnUrl = `${returnUrl}${preCreatedPaymentId}`;
      }
    }

    // Initiate with payment gateway
    const result = await method.initiatePayment(
      orderId,
      amount,
      currency,
      configData,
      paymentUserInput,
      userId
    );

    // For methods that return a redirectUrl, append the paymentId to the returnUrl
    if (result.redirectUrl && returnUrl && result.paymentId) {
      // Make sure redirectUrl can handle a return path
      const paymentGatewayUrl = new URL(result.redirectUrl);

      // Add returnUrl to the payment gateway URL if the method supports it
      if (methodCode === PaymentMethodCode.BINANCE_PAY ||
        methodCode === PaymentMethodCode.SADAD_PAY) {
        // Append or update returnUrl parameter with our complete URL
        paymentGatewayUrl.searchParams.set('returnUrl', `${returnUrl}${result.paymentId}`);
        result.redirectUrl = paymentGatewayUrl.toString();
      }
    }
    // For third-party methods, do not create DB records before payment
    if (methodCode !== PaymentMethodCode.MANUAL_PAYMENT && methodCode !== PaymentMethodCode.BANK_CARDS_ON_DELIVERY) {
      // Ensure Plutu creates/updates a payment record so verification can find it later
      if (isPlutuSubMethod(methodCode) && result.success) {
        const orderRecord = orderRecordForPlutu || await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
        if (!orderRecord) throw new Error("لم يتم العثور على الطلب.");

        // If we pre-created a record (redirect channels), just update it
        if (preCreatedPaymentId) {
          const resolvedStatus = result.nextStep ?? PaymentStatus.PENDING;
          await db.update(payments)
            .set({
              status: resolvedStatus,
              transactionId: result.transactionId,
              paymentData: { initiatedAt: new Date().toISOString(), ...(result.data || {}) } as BasePaymentData,
              updatedAt: new Date(),
            })
            .where(eq(payments.id, preCreatedPaymentId));
          result.paymentId = preCreatedPaymentId;

          // If payment completed immediately, update order and start delivery
          if (resolvedStatus === PaymentStatus.COMPLETED) {
            await db.update(orders)
              .set({ status: 'processing', paymentMethod: methodCode, updatedAt: new Date() })
              .where(eq(orders.id, orderRecord.id));
            await this.startDeliveryWorkflow(orderRecord, methodCode);
          }

          return result;
        }

        const existingPayment = await db.query.payments.findFirst({
          where: and(eq(payments.orderId, orderRecord.id), eq(payments.paymentMethod, methodCode))
        });

        const paymentPayload = {
          orderId: orderRecord.id,
          paymentMethod: methodCode,
          amount: amount.toString(),
          currency,
          status: result.nextStep ?? PaymentStatus.PENDING,
          paymentData: { initiatedAt: new Date().toISOString(), ...(result.data || {}) } as BasePaymentData,
          transactionId: result.transactionId,
          updatedAt: new Date(),
        };

        if (existingPayment) {
          await db.update(payments).set(paymentPayload).where(eq(payments.id, existingPayment.id));
          result.paymentId = existingPayment.id;
        } else {
          const newPayment = await db.insert(payments).values({
            ...paymentPayload,
            createdAt: new Date(),
          }).returning();
          result.paymentId = newPayment[0].id;
        }

        // If payment completed immediately (e.g. Plutu OTP confirm), update order and start delivery
        if ((result.nextStep ?? PaymentStatus.PENDING) === PaymentStatus.COMPLETED) {
          await db.update(orders)
            .set({ status: 'processing', paymentMethod: methodCode, updatedAt: new Date() })
            .where(eq(orders.id, orderRecord.id));
          await this.startDeliveryWorkflow(orderRecord, methodCode);
        }
      }
      return result;
    }

    // Fetch and validate order for manual payments (lookup by internal ID)
    const orderRecord = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!orderRecord) throw new Error("لم يتم العثور على الطلب.");
    if (orderRecord.status !== 'pending') throw new Error("لا يمكن معالجة الدفع لطلب غير معلق.");

    // Manual payment: create or update payment record and mark order processing
    let paymentId = result.paymentId;
    // Retrieve existing payment for this order and method
    const existingPayment = await db.query.payments.findFirst({
      where: and(eq(payments.orderId, orderRecord.id), eq(payments.paymentMethod, methodCode))
    });
    const paymentPayload = {
      orderId: orderRecord.id,
      paymentMethod: methodCode,
      amount: amount.toString(),
      currency: currency,
      status: result.nextStep ?? PaymentStatus.PENDING,
      paymentData: { initiatedAt: new Date().toISOString(), ...(result.data || {}) } as BasePaymentData,
      transactionId: result.transactionId,
      updatedAt: new Date(),
    };
    if (existingPayment) {
      await db.update(payments).set(paymentPayload).where(eq(payments.id, existingPayment.id));
      paymentId = existingPayment.id;
    } else {
      const newPayment = await db.insert(payments).values({
        ...paymentPayload,
        createdAt: new Date(),
      }).returning();
      paymentId = newPayment[0].id;
    }
    // Mark order as processing for manual payments
    await db.update(orders)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(orders.id, orderRecord.id));
    await this.startDeliveryWorkflow(orderRecord, methodCode);
    return { ...result, paymentId };
  }

  async verifyPayment(
    paymentId: string, // Our internal payment ID (for Moamalat this is the orderId)
    methodCode: PaymentMethodCode,
    verificationData: Record<string, any>
  ): Promise<any> {
    console.log('PaymentService.verifyPayment called with:', { paymentId, methodCode, verificationData });

    // First, check if payment is already verified to prevent duplicate processing
    let existingPayment = null;

    if (methodCode === PaymentMethodCode.MOAMALAT) {
      // For Moamalat, paymentId is the orderId
      const orderRecord = await db.query.orders.findFirst({ where: eq(orders.id, paymentId) });
      if (orderRecord) {
        existingPayment = await db.query.payments.findFirst({
          where: and(
            eq(payments.orderId, orderRecord.id),
            eq(payments.paymentMethod, methodCode),
            eq(payments.status, PaymentStatus.COMPLETED)
          )
        });
      }
    } else {
      // For other methods, paymentId is the actual payment ID
      existingPayment = await db.query.payments.findFirst({
        where: and(
          eq(payments.id, paymentId),
          eq(payments.status, PaymentStatus.COMPLETED)
        )
      });
    }

    if (existingPayment) {
      console.log('PaymentService.verifyPayment - payment already verified, returning existing result:', {
        paymentId: existingPayment.id,
        status: existingPayment.status,
        transactionId: existingPayment.transactionId
      });

      // Check if delivery needs to be started (retry mechanism)
      if (existingPayment.status === PaymentStatus.COMPLETED && existingPayment.orderId) {
        const orderRecord = await db.query.orders.findFirst({ where: eq(orders.id, existingPayment.orderId) });
        if (orderRecord) {
          // Ensure order status is updated to 'processing' if still pending
          if (orderRecord.status === 'pending') {
            console.log('Payment already completed but order still pending. Updating order status to processing...');
            await db.update(orders)
              .set({ status: 'processing', paymentMethod: methodCode, updatedAt: new Date() })
              .where(eq(orders.id, orderRecord.id));
          }
          // Check if tracking number is missing AND shipping status is pending (meaning not shipped yet)
          if (!orderRecord.trackingNumber && orderRecord.shippingStatus === 'pending') {
            console.log('Payment verified but tracking number missing. Attempting to start delivery again...');
            await this.startDeliveryWorkflow(orderRecord, methodCode, { enqueueInventory: false, reason: 'retry delivery after prior verification' });
          }
        }
      }

      return {
        success: true,
        status: existingPayment.status,
        message: "تم تأكيد الدفع مسبقاً",
        transactionId: existingPayment.transactionId,
        paymentId: existingPayment.id,
        paymentData: existingPayment.paymentData,
        alreadyVerified: true // Flag to indicate this was already verified
      };
    }

    const method = await this.getPaymentMethodInstance(methodCode);
    console.log('PaymentService.verifyPayment - method instance found:', !!method);

    if (!method || !method.verifyPayment) {
      console.error('PaymentService.verifyPayment - method not found or no verifyPayment function:', {
        methodFound: !!method,
        hasVerifyPayment: method?.verifyPayment ? true : false
      });
      throw new Error("طريقة الدفع غير صالحة أو لا تدعم التحقق.");
    }

    const configData = await this.getMethodConfigData(methodCode);
    console.log('PaymentService.verifyPayment - config data found:', !!configData);

    if (!configData) {
      console.error('PaymentService.verifyPayment - no config data found for method:', methodCode);
      throw new Error("لم يتم العثور على إعدادات طريقة الدفع.");
    }

    try {
      console.log('PaymentService.verifyPayment - calling method.verifyPayment with:', { paymentId, verificationData, configData });
      const result = await method.verifyPayment(paymentId, verificationData, configData);
      console.log('PaymentService.verifyPayment - method.verifyPayment result:', result);

      if (result.success) {
        // For Moamalat, we need to create the payment record since lightbox handles payment externally
        if (methodCode === PaymentMethodCode.MOAMALAT) {
          // Find the order first
          const orderRecord = await db.query.orders.findFirst({ where: eq(orders.id, paymentId) });
          if (!orderRecord) {
            throw new Error("لم يتم العثور على الطلب.");
          }

          // Check if payment already exists for this order and method
          const existingPayment = await db.query.payments.findFirst({
            where: and(eq(payments.orderId, orderRecord.id), eq(payments.paymentMethod, methodCode))
          });

          let finalPaymentId: string;
          const paymentData = (result as any).paymentData || {};

          if (existingPayment) {
            // Update existing payment
            await db.update(payments)
              .set({
                status: result.status,
                transactionId: result.transactionId,
                paymentData: paymentData as BasePaymentData,
                updatedAt: new Date()
              })
              .where(eq(payments.id, existingPayment.id));
            finalPaymentId = existingPayment.id;
          } else {
            // Create new payment record
            const newPayment = await db.insert(payments).values({
              orderId: orderRecord.id,
              paymentMethod: methodCode,
              amount: orderRecord.total.toString(),
              currency: 'LYD', // Default currency
              status: result.status,
              transactionId: result.transactionId,
              paymentData: paymentData as BasePaymentData,
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();
            finalPaymentId = newPayment[0].id;
          }

          // Update order status if payment is completed
          if (result.status === PaymentStatus.COMPLETED) {
            await db.update(orders)
              .set({ status: 'processing', paymentMethod: methodCode, updatedAt: new Date() })
              .where(eq(orders.id, orderRecord.id));
            await this.startDeliveryWorkflow(orderRecord, methodCode);
          }

          return { ...result, paymentId: finalPaymentId };
        } else {
          // For other payment methods, update existing payment record
          let paymentRecord = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });

          // Plutu compatibility: if paymentId was an orderId from older flows, create the payment record now
          if (!paymentRecord && isPlutuSubMethod(methodCode)) {
            const orderRecord = await db.query.orders.findFirst({ where: eq(orders.id, paymentId) });
            if (orderRecord) {
              const newPayment = await db.insert(payments).values({
                orderId: orderRecord.id,
                paymentMethod: methodCode,
                amount: orderRecord.total.toString(),
                currency: 'LYD',
                status: result.status,
                transactionId: result.transactionId,
                paymentData: ((result as any).paymentData || (result as any).data || {}) as BasePaymentData,
                createdAt: new Date(),
                updatedAt: new Date(),
              }).returning();
              paymentRecord = newPayment[0];
              paymentId = paymentRecord.id;
            }
          }

          if (!paymentRecord) {
            throw new Error("لم يتم العثور على سجل الدفع المطلوب للتحديث.");
          }

          await db.update(payments)
            .set({ status: result.status, transactionId: result.transactionId, updatedAt: new Date() })
            .where(eq(payments.id, paymentId));

          // Potentially update order status
          if (result.status === PaymentStatus.COMPLETED) {
            const paymentRecord = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
            if (paymentRecord && paymentRecord.orderId) {
              await db.update(orders).set({ status: 'processing', paymentMethod: methodCode, updatedAt: new Date() }).where(eq(orders.id, paymentRecord.orderId));
              const orderRec = await db.query.orders.findFirst({ where: eq(orders.id, paymentRecord.orderId) });
              await this.startDeliveryWorkflow(orderRec as typeof orders.$inferSelect, methodCode);
            }
          }
        }
      } else {
        // Verification failed: update payment status to reflect the failure
        // so it doesn't stay stuck at PENDING forever
        if (result.status && result.status !== PaymentStatus.PENDING) {
          const paymentRecord = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
          if (paymentRecord) {
            console.warn(`Payment verification failed for ${paymentId}, updating status from ${paymentRecord.status} to ${result.status}:`, result.message);
            await db.update(payments)
              .set({ status: result.status, updatedAt: new Date() })
              .where(eq(payments.id, paymentId));
          }
        }
      }
      return result;
    } catch (error: any) {
      console.error(`Error verifying payment ${paymentId} with ${methodCode}:`, error);
      throw new Error(error.message || "حدث خطأ أثناء التحقق من الدفع.");
    }
  }

  async handleWebhook(
    methodCode: PaymentMethodCode,
    payload: Record<string, any>,
    headers: Record<string, string>
  ): Promise<any> {
    const method = await this.getPaymentMethodInstance(methodCode);
    if (!method || !method.handleWebhook) {
      throw new Error("طريقة الدفع غير صالحة أو لا تدعم Webhooks.");
    }
    const configData = await this.getMethodConfigData(methodCode);
    if (!configData) {
      throw new Error("لم يتم العثور على إعدادات طريقة الدفع.");
    }

    try {
      const result = await method.handleWebhook(payload, headers, configData);
      if (result.success && result.paymentId && result.status) {
        await db.update(payments)
          .set({ status: result.status, transactionId: result.transactionId || undefined, updatedAt: new Date() })
          .where(eq(payments.id, result.paymentId));

        if (result.orderId && result.status === PaymentStatus.COMPLETED) {
          await db.update(orders).set({ status: 'processing', paymentMethod: methodCode, updatedAt: new Date() }).where(eq(orders.id, result.orderId));
          const orderRec = await db.query.orders.findFirst({ where: eq(orders.id, result.orderId) });
          await this.startDeliveryWorkflow(orderRec as typeof orders.$inferSelect, methodCode);
        }
      }
      if (methodCode === PaymentMethodCode.BINANCE_PAY) {
        return {
          returnCode: result.success ? 'SUCCESS' : 'FAIL',
        }
      }
      return result;
    } catch (error: any) {
      console.error(`Error handling webhook for ${methodCode}:`, error);
      throw new Error(error.message || "حدث خطأ أثناء معالجة Webhook.");
    }
  }

  async updatePaymentStatusByAdmin(
    paymentId: string,
    newStatus: PaymentStatus,
    adminNotes?: string,
    adminUserId?: string // Optional: for logging who made the change
  ): Promise<boolean> {
    try {
      const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
      if (!payment) throw new Error("لم يتم العثور على سجل الدفع.");

      const updateData: Partial<typeof payments.$inferInsert> = { status: newStatus, updatedAt: new Date() };

      let paymentData = (payment.paymentData || { initiatedAt: payment.createdAt.toISOString() }) as ManualPaymentData; // Assuming ManualPaymentData or a compatible BasePaymentData
      paymentData.adminNotes = adminNotes || paymentData.adminNotes;
      paymentData.lastUpdatedByAdminAt = new Date().toISOString();
      if (adminUserId) paymentData.adminUserId = adminUserId;

      updateData.paymentData = paymentData;

      await db.update(payments)
        .set(updateData)
        .where(eq(payments.id, paymentId));

      if (newStatus === PaymentStatus.COMPLETED && payment.orderId) {
        await db.update(orders).set({ status: 'processing', paymentMethod: payment.paymentMethod as PaymentMethodCode, updatedAt: new Date() }).where(eq(orders.id, payment.orderId));
        const orderRec = await db.query.orders.findFirst({ where: eq(orders.id, payment.orderId) });
        await this.startDeliveryWorkflow(orderRec as typeof orders.$inferSelect, payment.paymentMethod as PaymentMethodCode, { enqueueInventory: false, reason: 'admin status update' });
      } else if ((newStatus === PaymentStatus.FAILED || newStatus === PaymentStatus.CANCELLED) && payment.orderId) {
        // Optionally revert order status or handle accordingly
        // For now, we only update payment. Order status might need manual admin intervention or specific business logic.
      }

      return true;
    } catch (error: any) {
      console.error(`Error updating payment status for ${paymentId} by admin:`, error);
      throw new Error(error.message || "حدث خطأ أثناء تحديث حالة الدفع.");
    }
  }

  // List payments with pagination, search, filtering, and sorting (admin)
  async listPayments(params: {
    page?: number;
    perPage?: number;
    search?: string;
    status?: PaymentStatus;
    methodCode?: PaymentMethodCode;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: Array<{
      id: string;
      orderId: string;
      orderNumber: string | null;
      amount: string;
      currency: string;
      status: PaymentStatus;
      paymentMethod: PaymentMethodCode;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    perPage: number;
  }> {
    const pageNum = params.page && params.page > 0 ? params.page : 1;
    const perPageNum = params.perPage && params.perPage > 0 ? params.perPage : 10;
    const offset = (pageNum - 1) * perPageNum;

    // Build filters
    const filters: any[] = [];
    if (params.search) {
      filters.push(or(
        eq(payments.transactionId, params.search),
        eq(payments.id, params.search)
      ));
    }
    if (params.status) {
      filters.push(eq(payments.status, params.status));
    }
    if (params.methodCode) {
      filters.push(eq(payments.paymentMethod, params.methodCode));
    }
    const whereClause = filters.length ? and(...filters) : undefined;

    // Count total matching records
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(whereClause ?? undefined);
    const total = Number(totalResult[0]?.count ?? 0);

    // Determine sort column (default createdAt)
    let orderByColumn: AnyColumn = payments.createdAt;
    switch (params.sortBy) {
      case 'amount':
        orderByColumn = payments.amount;
        break;
      case 'status':
        orderByColumn = payments.status;
        break;
      case 'paymentMethod':
        orderByColumn = payments.paymentMethod;
        break;
      case 'transactionId':
        orderByColumn = payments.transactionId;
        break;
    }

    // Determine sort expression
    const orderByExpr = params.sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);
    // Fetch paginated data with orderNumber via join
    const rawData = await db.select({
      id: payments.id,
      orderId: payments.orderId,
      orderNumber: orders.orderNumber,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      createdAt: payments.createdAt,
    })
      .from(payments)
      .leftJoin(orders, eq(payments.orderId, orders.id))
      .where(whereClause ?? undefined)
      .orderBy(orderByExpr)
      .limit(perPageNum)
      .offset(offset);

    // Cast string columns to enums
    const data = rawData.map((row) => ({
      ...row,
      status: row.status as PaymentStatus,
      paymentMethod: row.paymentMethod as PaymentMethodCode,
    }));
    return { data, total, page: pageNum, perPage: perPageNum };
  }

  static async seedPaymentMethodConfigurations() {
    console.log("Seeding payment method configurations...");
    const methodsToSeed: Omit<PaymentMethodConfiguration, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        methodCode: PaymentMethodCode.BINANCE_PAY,
        displayName: "Binance Pay (بينانس باي)",
        description: "الدفع باستخدام محفظة بينانس باي.",
        configData: { apiKey: "YOUR_BINANCE_API_KEY", apiSecret: "YOUR_BINANCE_API_SECRET", merchantId: "YOUR_MERCHANT_ID", multiplier: 1 }, // Admin needs to fill and adjust multiplier
        isEnabled: false, // Disabled by default until configured
        sortOrder: 1,
      },
      {
        methodCode: PaymentMethodCode.MANUAL_PAYMENT,
        displayName: "دفع يدوي (تحويل بنكي/نقدي)",
        description: "لتأكيد المدفوعات التي تتم يدوياً خارج النظام. يرجى تقديم تفاصيل التحويل في الملاحظات.",
        configData: {
          instructionsAr: "يرجى تحويل المبلغ المطلوب إلى حسابنا: [تفاصيل الحساب]. بعد التحويل، يرجى إرفاق الإيصال أو الاتصال بنا لتأكيد الدفع.",
          instructionsEn: "Please transfer the amount to: [Account Details]. After transfer, please attach receipt or contact us to confirm."
        },
        isEnabled: true,
        sortOrder: 2,
      },
      {
        methodCode: PaymentMethodCode.BANK_CARDS_ON_DELIVERY,
        displayName: "بطاقة مصرفية عند الاستلام",
        description: "الدفع عن طريق بطاقة مصرفية عبر جهاز POS أثناء التوصيل.",
        configData: {
          instructionsAr: "سيقوم مندوب التوصيل بإحضار جهاز الدفع (POS) لتتمكن من الدفع باستخدام بطاقتك المصرفية المحلية عند استلام الطلب.",
          instructionsEn: "The delivery agent will bring a POS terminal for you to pay with your local bank card upon receiving the order."
        },
        isEnabled: true,
        sortOrder: 3,
      },
      {
        methodCode: PaymentMethodCode.SADAD_PAY,
        displayName: "سداد باي (SADAD Pay)",
        description: "الدفع عبر خدمة سداد باي.",
        configData: {
          apiKey: "YOUR_SADAD_API_KEY",
          merchantId: "YOUR_SADAD_MERCHANT_ID",
          secretKey: "YOUR_SADAD_SECRET_KEY",
          testMode: true
        },
        isEnabled: false,
        sortOrder: 3,
      },
      {
        methodCode: PaymentMethodCode.MOAMALAT,
        displayName: "معاملات (Moamalat)",
        description: "الدفع عبر شبكة معاملات.",
        configData: {
          merchantId: "10081014649",
          terminalId: "99179395",
          secureKey: "3a488a89b3f7993476c252f017c488bb",
          sandboxMode: true, // Add sandbox mode flag
        },
        isEnabled: false, // Enable for testing
        sortOrder: 4,
      },
      {
        methodCode: PaymentMethodCode.PLUTU,
        displayName: "بلوتو (Pluto)",
        description: "بوابة دفع بلوتو متعددة القنوات.",
        configData: {
          apiKey: "YOUR_PLUTU_API_KEY",
          secretKey: "YOUR_PLUTU_SECRET_KEY",
          accessToken: "YOUR_PLUTU_ACCESS_TOKEN",
          apiSecret: "YOUR_PLUTU_API_SECRET",
          sandboxMode: true,
          enableSadadApi: false,
          enableEdFali: false,
          enableMpgs: false,
          enableTlync: false,
          enableLocalCards: false,
        },
        isEnabled: false,
        sortOrder: 5,
      },
    ];

    for (const methodSeed of methodsToSeed) {
      try {
        const existing = await db.query.paymentMethodConfigurations.findFirst({
          where: eq(paymentMethodConfigurations.methodCode, methodSeed.methodCode)
        });
        if (!existing) {
          await db.insert(paymentMethodConfigurations).values({
            ...methodSeed,
            configData: JSON.stringify(methodSeed.configData) // Ensure it's stringified for DB
          });
          console.log(`Seeded ${methodSeed.displayName}`);
        } else {
          // Optionally update existing configurations if needed, e.g., description or default isEnabled status
          // For now, just log that it exists.
          console.log(`${methodSeed.displayName} already exists. Skipping seed.`);
        }
      } catch (e) {
        console.error(`Error seeding ${methodSeed.methodCode}: `, e)
      }
    }
  }
}

// Example of how to run the seeder (e.g., in a separate script or an initialization routine)
// if (process.env.NODE_ENV !== 'production') { // Or some other condition
//   PaymentService.seedPaymentMethodConfigurations().catch(console.error);
// }
