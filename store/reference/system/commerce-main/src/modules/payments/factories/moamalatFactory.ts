import {
  PaymentMethod,
  PaymentMethodCode,
  PaymentStatus,
  BasePaymentData,
  PaymentMethodConfigField
} from "@/modules/payments/types/paymentTypes";
import crypto from "crypto";

/**
 * Generates a SHA-256 HMAC secure hash for Moamalat according to official documentation.
 * @param params The parameters to include in the hash.
 * @param secretKey The merchant's hex-encoded secret key.
 * @returns The uppercase hex-encoded HMAC hash.
 */
function generateSecureHash(params: Record<string, any>, secretKey: string, sort: boolean, filter: boolean): string {
  // 1. Filter out null/undefined values and sort by parameter name
  const filteredKeys = filter ? Object.keys(params).filter(key => params[key] !== null && params[key] !== undefined && params[key] !== '') : Object.keys(params);
  const sortedKeys = sort ? filteredKeys.sort() : filteredKeys;

  // 2. Construct the string "key=value&key=value"
  const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

  console.log("Moamalat Hash Debug:", {
    originalParams: params,
    filteredKeys: sortedKeys,
    paramString: paramString,
    secretKeyLength: secretKey?.length
  });

  // 3. CRITICAL: Decode the hex secret key as per documentation
  if (typeof secretKey !== 'string' || !secretKey) {
    throw new Error('المفتاح السري غير صالح أو مفقود لإنشاء SecureHash');
  }
  
  // Convert hex string to buffer - the documentation states "hex decoded value"
  const secretKeyBuffer = Buffer.from(secretKey, 'hex');
  
  // 4. Create a SHA-256 HMAC using the hex-decoded secret key
  const hmac = crypto.createHmac('sha256', secretKeyBuffer);
  hmac.update(paramString);

  // 5. Encode in uppercase hexadecimal
  return hmac.digest('hex').toUpperCase();
}

/**
 * Queries Moamalat's backend to verify transaction status using the Filter API
 * @param merchantReference The merchant reference to search for
 * @param methodConfig The payment method configuration
 * @returns Promise with transaction verification result
 */
async function queryMoamalatBackend(merchantReference: string, methodConfig: any): Promise<{
  success: boolean;
  transaction?: any;
  error?: string;
}> {
  try {
    const merchantId = methodConfig.merchantId;
    const terminalId = methodConfig.terminalId;
    const secureKey = methodConfig.secureKey;
    const sandboxMode = methodConfig.sandboxMode;

    // Generate current timestamp for API call in format YYMMDDHHMMSS
    const now = new Date();
    const dateTimeLocalTrxn = 
      `${now.getFullYear().toString().slice(-2)}` +
      `${(now.getMonth() + 1).toString().padStart(2, '0')}` +
      `${now.getDate().toString().padStart(2, '0')}` +
      `${now.getHours().toString().padStart(2, '0')}` +
      `${now.getMinutes().toString().padStart(2, '0')}` +
      `${now.getSeconds().toString().padStart(2, '0')}`;

    // Prepare API request parameters
    const apiParams = {
      MerchantReference: merchantReference,
      TerminalId: terminalId,
      MerchantId: merchantId,
      DisplayLength: "10", // Get up to 10 transactions
      DisplayStart: "0",   // Start from first result
      DateTimeLocalTrxn: dateTimeLocalTrxn
    };

    // Generate secure hash for API request (only these 3 fields as per documentation)
    const hashParams = {
      DateTimeLocalTrxn: dateTimeLocalTrxn,
      MerchantId: merchantId,
      TerminalId: terminalId
    };
    
    const secureHash = generateSecureHash(hashParams, secureKey, true, true);
    
    const requestPayload = {
      ...apiParams,
      SecureHash: secureHash
    };

    console.log("Moamalat Backend Query:", {
      merchantReference,
      requestPayload: { ...requestPayload, SecureHash: "***HIDDEN***" },
      endpoint: sandboxMode ? "test" : "production"
    });

    // Call Moamalat Filter API
    const apiUrl = sandboxMode 
      ? "https://tnpg.moamalat.net/cube/paylink.svc/api/FilterTransactions"
      : "https://npg.moamalat.net/cube/paylink.svc/api/FilterTransactions";

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log("Moamalat Backend Response:", {
      success: result.Success,
      message: result.Message,
      transactionCount: result.TotalCountAllTransaction,
      hasTransactions: result.Transactions?.length > 0
    });

    if (!result.Success) {
      return {
        success: false,
        error: result.Message || "فشل في الاستعلام عن بيانات المعاملة من خادم معاملات"
      };
    }

    // Find the transaction with matching merchant reference
    let matchingTransaction = null;
    if (result.Transactions && result.Transactions.length > 0) {
      // Search through all date groups and their transactions
      for (const dateGroup of result.Transactions) {
        if (dateGroup.DateTransactions) {
          for (const transaction of dateGroup.DateTransactions) {
            if (transaction.MerchantReference === merchantReference) {
              matchingTransaction = transaction;
              break;
            }
          }
        }
        if (matchingTransaction) break;
      }
    }

    if (!matchingTransaction) {
      return {
        success: false,
        error: "لم يتم العثور على المعاملة في نظام معاملات"
      };
    }

    return {
      success: true,
      transaction: matchingTransaction
    };

  } catch (error) {
    console.error("Moamalat backend query error:", error);
    return {
      success: false,
      error: "خطأ في الاتصال بخادم معاملات للتحقق من المعاملة"
    };
  }
}

/**
 * Factory function to create Moamalat Payment method instance
 * @param configData Configuration data for Moamalat
 */
export function createMoamalatMethod(configData: Record<string, any>): PaymentMethod {
  const configurationFields: PaymentMethodConfigField[] = [
    { name: "terminalId", label: "معرف الترمينال", type: "text", required: true },
    { name: "merchantId", label: "معرف التاجر", type: "text", required: true },
    { name: "secureKey", label: "المفتاح السري", type: "password", required: true },
    { name: "sandboxMode", label: "وضع الاختبار", type: "boolean", required: false },
  ];

  return {
    code: PaymentMethodCode.MOAMALAT,
    name: "معاملات (Moamalat)",
    description: configData.sandboxMode ? "اختبار معاملات عبر Moamalat" : "الدفع عبر شبكة معاملات",
    isEnabled: true,
    configurationFields,
    userInputFields: [],

    async initiatePayment(orderId, amount, currency, methodConfig, userInput, userId) {
      // Ensure essential config values are present
      const merchantId = methodConfig.merchantId;
      const terminalId = methodConfig.terminalId;
      const secureKey = methodConfig.secureKey;
      if (!merchantId || !terminalId || !secureKey) {
        throw new Error("إعدادات معاملات Moamalat غير مكتملة. يرجى التحقق من terminalId, merchantId, و secureKey.");
      }

      console.log("Moamalat: Initiating payment", { orderId, amount, currency });
      console.log("Moamalat: Config", { merchantId, terminalId, sandboxMode: methodConfig.sandboxMode });

      // Amount in smallest currency unit (e.g., 1 LYD = 1000) as per documentation
      const amountInSmallestUnit = Math.round(amount * 1000);
      console.log("Moamalat: Amount conversion", { originalAmount: amount, convertedAmount: amountInSmallestUnit });

      // Format: yyyyMMddHHmm
      const dateTime = new Date();
      const dateTimeLocalTrxn = 
        `${dateTime.getFullYear()}` +
        `${(dateTime.getMonth() + 1).toString().padStart(2, '0')}` +
        `${dateTime.getDate().toString().padStart(2, '0')}` +
        `${dateTime.getHours().toString().padStart(2, '0')}` +
        `${dateTime.getMinutes().toString().padStart(2, '0')}`;

      const merchantReference = orderId;

      // Use EXACT parameter names from official documentation for hash generation
      const hashParams = {
        Amount: amountInSmallestUnit,
        DateTimeLocalTrxn: dateTimeLocalTrxn,
        MerchantId: merchantId,
        MerchantReference: merchantReference,
        TerminalId: terminalId,
      };

      const secureHash = generateSecureHash(hashParams, secureKey, true, true);
      
      console.log("Moamalat: Hash generation", {
        hashParams,
        generatedHash: secureHash,
        dateTime: dateTimeLocalTrxn
      });

      const lightboxConfig = {
        MID: merchantId,
        TID: terminalId,
        AmountTrxn: amountInSmallestUnit,
        MerchantReference: merchantReference,
        TrxDateTime: dateTimeLocalTrxn,
        SecureHash: secureHash,
        OrderID: orderId, // Use OrderID (capital D) as expected by the script
        paymentMethodFromLightBox: 'card',
        paymentId: orderId, // Add paymentId for frontend verification
        sandboxMode: methodConfig.sandboxMode, // Include sandbox mode info for frontend
      };

      return {
        success: true,
        paymentId: orderId,
        nextStep: PaymentStatus.PENDING, // The frontend will handle the lightbox
        message: "جاري تهيئة بوابة الدفع.",
        data: {
          lightboxConfig,
        },
      };
    },

    async verifyPayment(paymentId, verificationData, methodConfig) {
      console.log("Moamalat: Verifying payment via backend query", { paymentId, verificationData });
      
      // Extract merchant reference from verification data
      const merchantReference = verificationData.MerchantReference || paymentId;
      
      if (!merchantReference) {
        return { 
          success: false, 
          status: PaymentStatus.FAILED, 
          message: "لم يتم العثور على مرجع التاجر في بيانات التحقق." 
        };
      }

      // Query Moamalat's backend to get the actual transaction status
      const backendResult = await queryMoamalatBackend(merchantReference, methodConfig);
      
      if (!backendResult.success) {
        console.error("Moamalat backend verification failed:", backendResult.error);
        return {
          success: false,
          status: PaymentStatus.FAILED,
          message: backendResult.error || "فشل في التحقق من المعاملة عبر خادم معاملات.",
        };
      }

      const transaction = backendResult.transaction;
      console.log("Moamalat backend transaction found:", {
        merchantReference: transaction.MerchantReference,
        status: transaction.Status,
        resCodeDesc: transaction.ResCodeDesc,
        amount: transaction.Amnt,
        rrn: transaction.RRN,
        transactionId: transaction.TransactionId
      });

      // Check if transaction is approved based on backend data
      const isSuccess = transaction.Status === "Approved" && transaction.ResCodeDesc === "Approved";
      
      // Extract transaction details from backend response
      const systemReference = transaction.RRN; // Retrieval Reference Number
      const transactionId = transaction.TransactionId;
      const amount = transaction.Amnt;
      const currency = transaction.Currency;
      const txnDateTime = transaction.TxnDateTime;
      const cardType = transaction.CardType;
      const cardNo = transaction.CardNo;

      console.log("Moamalat payment verification via backend:", {
        merchantReference,
        isSuccess,
        status: transaction.Status,
        resCodeDesc: transaction.ResCodeDesc,
        systemReference,
        transactionId,
        amount,
        currency,
        txnDateTime,
        cardType
      });

      return {
        success: isSuccess,
        status: isSuccess ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        message: isSuccess 
          ? "تم تأكيد الدفع عبر معاملات" 
          : `فشل الدفع عبر معاملات - ${transaction.ResCodeDesc || transaction.Status}`,
        transactionId: systemReference,
        paymentData: {
          responseCode: "00", // Set to 00 for approved transactions
          systemReference,
          merchantReference,
          amount,
          currency,
          txnDate: txnDateTime,
          transactionId,
          cardType,
          cardNo,
          status: transaction.Status,
          resCodeDesc: transaction.ResCodeDesc,
          completedAt: new Date().toISOString(),
          verificationMethod: "backend_query" // Indicate this was verified via backend
        }
      };
    },

    async handleWebhook(payload, headers, methodConfig) {
      console.log("Moamalat: Webhook payload", payload);
      // Verify notification HMAC
      const receivedHash = payload.SecureHash;
      if (!receivedHash) {
        return { success: false, status: PaymentStatus.FAILED, message: "فشل التحقق من توقيع الإشعار." };
      }
      const { SecureHash, ...paramsToHash } = payload;
      const calculatedHash = generateSecureHash(paramsToHash, methodConfig.secureKey, true, true);
      if (calculatedHash !== receivedHash) {
        console.error("Moamalat notification hash mismatch:", { receivedHash, calculatedHash });
        return { success: false, status: PaymentStatus.FAILED, message: "فشل التحقق من توقيع الإشعار." };
      }
      // Determine success via ResponseCode
      const success = payload.ResponseCode === "00";
      return {
        success,
        orderId: payload.MerchantReference,
        transactionId: payload.SystemReference,
        status: success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        message: payload.Message,
      };
    },
  };
}
