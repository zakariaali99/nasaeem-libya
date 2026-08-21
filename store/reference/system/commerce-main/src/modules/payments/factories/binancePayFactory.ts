import { PaymentMethod, PaymentMethodCode, PaymentStatus } from "@/modules/payments/types/paymentTypes";
import crypto from 'crypto';
import { db } from "@/lib/db/drizzle";
import { orders, orderItems, payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// helper: generate a 32-character nonce (letters only) per Binance webhook spec
function generateNonce(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

// Fetch Binance Pay certificate by serial number
async function fetchBinanceCertificate(serial: string, configData: Record<string, any>) {
  const host = configData.host || 'https://bpay.binanceapi.com';
  const timestamp = Date.now().toString();
  const nonce = generateNonce();
  const url = `${host}/binancepay/openapi/certificates`;
  const payloadBody = JSON.stringify({ certSerial: serial });
  const signContent = `${timestamp}\n${nonce}\n${payloadBody}\n`;
  const signature = crypto.createHmac('sha512', configData.apiSecret)
    .update(signContent)
    .digest('hex')
    .toUpperCase();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': configData.apiKey,
      'BinancePay-Signature': signature,
    },
    body: payloadBody,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.errorMessage || 'Failed to fetch certificate');
  // return public key PEM
  return result.data.certPublic;
}

// Verify webhook signature using RSA public key
async function verifyBinanceWebhookSignature(
  headers: Record<string, string>,
  payload: string,
  configData: Record<string, any>
) {
  const ts = headers['BinancePay-Timestamp'];
  const nonce = headers['BinancePay-Nonce'];
  const sn = headers['BinancePay-Certificate-SN'];
  const sig = headers['BinancePay-Signature'];
  if (!ts || !nonce || !sn || !sig) throw new Error('Missing webhook signature headers');
  const t = parseInt(ts, 10);
  if (Math.abs(Date.now() - t) > 1000) throw new Error('Invalid timestamp');
  const signContent = `${ts}\n${nonce}\n${payload}\n`;
  const certPem = await fetchBinanceCertificate(sn, configData);
  const verify = crypto.createVerify('sha256');
  verify.update(signContent);
  verify.end();
  const valid = verify.verify(certPem, sig, 'base64');
  if (!valid) throw new Error('Invalid webhook signature');
}

 /**
 * Factory function to create Binance Pay payment method instance
 * @param configData Configuration data for Binance Pay
 */
export function createBinancePayMethod(configData: Record<string, any>): PaymentMethod {
  return {
    code: PaymentMethodCode.BINANCE_PAY,
    name: "بينانس باي",
    description: "الدفع باستخدام محفظة بينانس باي",
    isEnabled: true,
    configurationFields: [
      { name: "apiKey", label: "مفتاح API", type: "text", required: true, isSecure: true },
      { name: "apiSecret", label: "كلمة سر API", type: "password", required: true, isSecure: true },
      { name: "merchantId", label: "رقم التاجر", type: "text", required: true },
    ],
    initiatePayment: async (
      orderId: string,
      amount: number,
      currency: string,
      configData: Record<string, any>,
      userInput?: Record<string, any>,
      userId?: string,
    ) => {
      try {
        // Determine host and endpoint
        const host = configData.host || 'https://bpay.binanceapi.com';
        const url = `${host}/binancepay/openapi/v3/order`;
        // Apply exchange rate multiplier if currency is not USDT
        const multiplier = configData.multiplier || 1;
        const usdtAmount = (currency === 'USDT') ? amount : parseFloat((amount * multiplier).toFixed(2));
        // Build request payload
        const payloadBody = JSON.stringify({
          merchantId: configData.merchantId,
          merchantTradeNo: orderId,
          amount: usdtAmount.toString(),
          currency: 'USDT',
          // Optional: attach callback or return URLs if defined in config
          ...(configData.returnUrl && { returnUrl: configData.returnUrl }),
          ...(configData.notifyUrl && { notifyUrl: configData.notifyUrl }),
        });
        const timestamp = Date.now().toString();
        const nonce = generateNonce();
        // Build signature content
        const signatureContent = `${timestamp}\n${nonce}\n${payloadBody}\n`;
        const signature = crypto.createHmac('sha512', configData.apiSecret)
          .update(signatureContent)
          .digest('hex')
          .toUpperCase();
        // Make API call
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'BinancePay-Timestamp': timestamp,
            'BinancePay-Nonce': nonce,
            'BinancePay-Certificate-SN': configData.apiKey,
            'BinancePay-Signature': signature,
          },
          body: payloadBody,
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.errorMessage || result.message || 'API Error');
        }
        // Parse response data
        const data = result.data || {};
        return {
          success: true,
          paymentId: data.prepayId,
          transactionId: data.prepayId,
          redirectUrl: data.checkoutUrl,
          nextStep: PaymentStatus.PENDING,
          message: 'تم بدء عملية الدفع بنجاح',
          data: {
            prepayId: data.prepayId,
            checkoutUrl: data.checkoutUrl,
            timestamp: new Date().toISOString(),
          }
        };
      } catch (error: any) {
        console.error('Error initiating Binance Pay payment:', error);
        return {
          success: false,
          message: error.message || 'فشل في بدء عملية الدفع. يرجى المحاولة مرة أخرى.',
        };
      }
    },
    
    // Verify the payment status - this would be called after user completes payment
    verifyPayment: async (
      paymentId: string,
      verificationData: Record<string, any>,
      configData: Record<string, any>,
    ) => {
      // Perform real status query via Binance Pay API
      const host = configData.host || 'https://bpay.binanceapi.com';
      const url = `${host}/binancepay/openapi/v3/query?merchantTradeNo=${paymentId}&merchantId=${configData.merchantId}`;
      const timestamp = Date.now().toString();
      const nonce = generateNonce();
      // no body for GET, signature over empty body
      const payloadBody = '';
      const signatureContent = `${timestamp}\n${nonce}\n${payloadBody}\n`;
      const signature = crypto.createHmac('sha512', configData.apiSecret)
        .update(signatureContent)
        .digest('hex')
        .toUpperCase();
      const headers = {
        'BinancePay-Timestamp': timestamp,
        'BinancePay-Nonce': nonce,
        'BinancePay-Certificate-SN': configData.apiKey,
        'BinancePay-Signature': signature,
      };
      const response = await fetch(url, { method: 'GET', headers });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.errorMessage || result.message || 'API Error');
      }
      // Map status
      const statusStr = result.data?.status;
      let status = PaymentStatus.PENDING;
      if (statusStr === 'PAY_SUCCESS' || statusStr === 'PAID') status = PaymentStatus.COMPLETED;
      else if (statusStr === 'PAY_CLOSED' || statusStr === 'PAY_FAIL') status = PaymentStatus.FAILED;
      else if (statusStr === 'PAY_REFUND') status = PaymentStatus.REFUNDED;
      return { success: true, status, message: result.data?.message || 'تم التحقق من الدفع بنجاح', transactionId: result.data?.transactionId };
     },
    
    // Handle webhook callbacks from Binance Pay
    handleWebhook: async (
      payload: Record<string, any>,
      headers: Record<string, string>,
      configData: Record<string, any>,
    ) => {
      try {
        console.log("Processing Binance Pay webhook:", payload);
        // Verify signature against fetched certificate
        const raw = JSON.stringify(payload);
        await verifyBinanceWebhookSignature(headers, raw, configData);
        // Signature valid, extract payload and map status, map merchantTradeNo to orderNumber
        const { prepayId, status, merchantTradeNo: merchantRef, transactionId } = payload;
        let paymentStatus = PaymentStatus.PENDING;
        if (status === "PAY_SUCCESS" || status === "PAID") paymentStatus = PaymentStatus.COMPLETED;
        else if (status === "PAY_CLOSED" || status === "PAY_FAIL") paymentStatus = PaymentStatus.FAILED;

        // Perform DB operations based on webhook result
        // Locate the order record by its external reference (orderNumber)
        const orderRecord = await db.query.orders.findFirst({ where: eq(orders.orderNumber, merchantRef) });
        if (orderRecord) {
          if (paymentStatus === PaymentStatus.COMPLETED) {
            // Insert payment record
            await db.insert(payments).values({
              orderId: orderRecord.id,
              paymentMethod: PaymentMethodCode.BINANCE_PAY,
              amount: payload.amount?.toString() || orderRecord.total.toString(),
              currency: payload.currency || 'USDT',
              status: paymentStatus,
              paymentData: payload,
              transactionId: transactionId || prepayId,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            // Update order to processing
            await db.update(orders)
              .set({ status: 'processing', paymentMethod: PaymentMethodCode.BINANCE_PAY, updatedAt: new Date() })
              .where(eq(orders.id, orderRecord.id));
          } else if (status === "PAY_CLOSED") {
            // Remove unconfirmed order and its items
            await db.delete(orderItems).where(eq(orderItems.orderId, orderRecord.id));
            await db.delete(orders).where(eq(orders.id, orderRecord.id));
          }
        }

        return {
          success: true,
          orderId: merchantRef,
          paymentId: prepayId,
          transactionId: transactionId || `TX_${Date.now()}`,
          status: paymentStatus,
          message: "تم معالجة إشعار الدفع بنجاح"
        };
      } catch (error: any) {
        console.error("Error processing Binance Pay webhook:", error);
        return {
          success: false,
          message: "فشل في معالجة إشعار الدفع"
        };
      }
    }
  };
}
