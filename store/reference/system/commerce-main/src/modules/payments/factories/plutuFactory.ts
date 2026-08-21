import { PaymentMethod, PaymentMethodCode, PaymentStatus, PaymentMethodConfigField } from "@/modules/payments/types/paymentTypes";
import crypto from "crypto";

type PlutuChannel = "sadad" | "edfali" | "mpgs" | "tlync" | "local_cards";

const channelMeta: Record<PlutuChannel, { code: PaymentMethodCode; name: string; description: string; configFlag: keyof PlutuConfig; gateway: string }> = {
  sadad: { code: PaymentMethodCode.PLUTU_SADAD, name: "سداد (عبر بلوتو)", description: "دفع عبر قناة سداد API المقدمة من بلوتو", configFlag: "enableSadadApi", gateway: "sadadapi" },
  edfali: { code: PaymentMethodCode.PLUTU_EDFALI, name: "إدفعلي (عبر بلوتو)", description: "دفع عبر إدفعلي من خلال بلوتو", configFlag: "enableEdFali", gateway: "edfali" },
  mpgs: { code: PaymentMethodCode.PLUTU_MPGS, name: "MPGS (عبر بلوتو)", description: "بوابة ماستركارد للدفع عبر بلوتو", configFlag: "enableMpgs", gateway: "mpgs" },
  tlync: { code: PaymentMethodCode.PLUTU_TLYNC, name: "Tlync (عبر بلوتو)", description: "دفع عبر Tlync من خلال بلوتو", configFlag: "enableTlync", gateway: "tlync" },
  local_cards: { code: PaymentMethodCode.PLUTU_LOCAL_CARDS, name: "بطاقات محلية (عبر بلوتو)", description: "دفع بالبطاقات المحلية بواسطة بلوتو", configFlag: "enableLocalCards", gateway: "localbankcards" },
};

type PlutuConfig = {
  apiKey: string;
  secretKey: string;
  accessToken: string;
  apiSecret?: string; // لبعض القنوات مثل MPGS / Tlync
  sandboxMode?: boolean;
  enableSadadApi?: boolean;
  enableEdFali?: boolean;
  enableMpgs?: boolean;
  enableTlync?: boolean;
  enableLocalCards?: boolean;
  apiBaseUrl?: string;
};

/**
 * Pluto (Plutu) aggregator payment method.
 * Acts as a container for multiple Plutu payment rails; each rail can be toggled from the admin UI.
 * Actual transaction flows are intentionally stubbed for now until specific rails are implemented.
 */
function buildConfigFields(channel: PlutuChannel): PaymentMethodConfigField[] {
  const shared: PaymentMethodConfigField[] = [
    { name: "apiKey", label: "مفتاح API", type: "text", required: true, isSecure: true },
    { name: "secretKey", label: "المفتاح السري", type: "password", required: true, isSecure: true },
    { name: "accessToken", label: "رمز الوصول (Access Token)", type: "password", required: true, isSecure: true },
    { name: "sandboxMode", label: "وضع الاختبار", type: "boolean", required: false },
    { name: "apiBaseUrl", label: "رابط API (اختياري)", type: "text", required: false },
    { name: "enableSadadApi", label: "تفعيل سداد API", type: "boolean", required: false },
    { name: "enableEdFali", label: "تفعيل إدفعلي", type: "boolean", required: false },
    { name: "enableMpgs", label: "تفعيل MPGS", type: "boolean", required: false },
    { name: "enableTlync", label: "تفعيل Tlync", type: "boolean", required: false },
    { name: "enableLocalCards", label: "تفعيل البطاقات المحلية", type: "boolean", required: false },
  ];
  const needsApiSecret = channel === "mpgs" || channel === "tlync" || channel === "local_cards";
  if (needsApiSecret) {
    shared.splice(2, 0, { name: "apiSecret", label: "API Secret (إن وجد)", type: "password", required: false, isSecure: true });
  }
  return shared;
}

async function plutuRequest({
  cfg,
  gateway,
  endpoint,
  payload,
}: {
  cfg: PlutuConfig;
  gateway: string;
  endpoint: "confirm" | "verify";
  payload: Record<string, any>;
}) {
  const base = cfg.apiBaseUrl || "https://api.plutus.ly/api/v1";
  const url = `${base}/transaction/${gateway}/${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    "X-API-KEY": cfg.apiKey,
    Authorization: `Bearer ${cfg.accessToken}`,
  } as const;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

/**
 * Known callback parameters per channel, in the exact order defined by Plutu's official PHP SDK.
 * The hash is computed ONLY over these fields, in this order.
 * @see https://github.com/getplutu/plutu-php/blob/main/src/Services/
 */
const channelCallbackFields: Record<string, string[]> = {
  localbankcards: ['gateway', 'approved', 'canceled', 'invoice_no', 'amount', 'transaction_id'],
  mpgs: ['gateway', 'approved', 'canceled', 'amount', 'currency', 'invoice_no', 'transaction_id'],
  // Tlync has two modes: callback (server-to-server) and return (redirect). We support both field sets.
  tlync_callback: ['gateway', 'approved', 'invoice_no', 'amount', 'transaction_id', 'payment_method'],
  tlync_return: ['approved', 'invoice_no'],
};

function verifyPlutuHash(
  secretKey: string | undefined,
  data: Record<string, any>,
  channel: PlutuChannel
): { valid: boolean; debug: { receivedHash: string; computedHash: string; baseString: string; includedKeys: string[] } } {
  const emptyDebug = { receivedHash: '', computedHash: '', baseString: '', includedKeys: [] as string[] };
  if (!secretKey) return { valid: true, debug: emptyDebug }; // لا يمكن التحقق بدون secretKey

  const receivedHash = ((data?.hashed || data?.hash || data?.Hashed) || '').toString().toUpperCase();
  if (!receivedHash) return { valid: true, debug: emptyDebug }; // No hash to verify against

  // Determine which callback field set to use
  let fieldSet: string[];
  if (channel === 'tlync') {
    // Use return handler fields if we have fewer params (redirect), callback if more (server-to-server)
    fieldSet = data.gateway ? (channelCallbackFields.tlync_callback) : (channelCallbackFields.tlync_return);
  } else {
    const gateway = channelMeta[channel]?.gateway || channel;
    fieldSet = channelCallbackFields[gateway] || channelCallbackFields.localbankcards;
  }

  // Build the base string using ONLY the defined callback fields, in order,
  // matching PHP's http_build_query(array_filter(...)) behavior:
  // - Only include fields that exist and are not undefined/null
  // - URL-encode the values
  const includedKeys: string[] = [];
  const parts: string[] = [];
  for (const key of fieldSet) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      includedKeys.push(key);
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(data[key]))}`);
    }
  }
  const baseString = parts.join('&');

  const computed = crypto.createHmac('sha256', secretKey).update(baseString).digest('hex').toUpperCase();
  const valid = computed === receivedHash;

  if (!valid) {
    // Also try without URL encoding (in case Plutu doesn't encode simple values)
    const rawBaseString = includedKeys.map((k) => `${k}=${data[k]}`).join('&');
    const rawComputed = crypto.createHmac('sha256', secretKey).update(rawBaseString).digest('hex').toUpperCase();
    if (rawComputed === receivedHash) {
      return { valid: true, debug: { receivedHash, computedHash: rawComputed, baseString: rawBaseString, includedKeys } };
    }

    console.warn('Plutu hash mismatch:', {
      receivedHash,
      computedHash: computed,
      rawComputed,
      includedKeys,
      baseString,
      rawBaseString,
    });
  }

  return { valid, debug: { receivedHash, computedHash: computed, baseString, includedKeys } };
}


export function createPlutuMethod(configData: Record<string, any>, channel: PlutuChannel): PaymentMethod {
  const configurationFields: PaymentMethodConfigField[] = buildConfigFields(channel);

  return {
    code: channelMeta[channel].code,
    name: channelMeta[channel].name,
    description: channelMeta[channel].description,
    isEnabled: true,
    configurationFields,
    userInputFields: channel === "sadad" || channel === "edfali"
      ? [
        { name: "mobile_number", label: "رقم الهاتف (يبدأ بـ 091 أو 093)", type: "text", required: true },
        { name: "birth_year", label: "سنة الميلاد (YYYY)", type: "text", required: true },
        { name: "otp", label: "رمز التحقق (OTP)", type: "text", required: false },
      ]
      : [],

    async initiatePayment(orderId, amount, currency, methodConfig, userInput?: Record<string, any>) {
      const cfg = methodConfig as PlutuConfig;
      const flag = cfg[channelMeta[channel].configFlag];
      if (!flag) {
        return {
          success: false,
          message: "القناة غير مفعلة في إعدادات بلوتو. يرجى تفعيلها أولاً من لوحة التحكم.",
        };
      }

      const gateway = channelMeta[channel].gateway;

      // Sadad / EdFali: خطوة إرسال OTP ثم تأكيد
      if (channel === "sadad" || channel === "edfali") {
        const hasOtp = Boolean(userInput?.otp);
        const amountLyd = amount; // المبلغ بليبي

        if (!hasOtp) {
          if (!userInput?.mobile_number || !userInput?.birth_year) {
            return { success: false, message: "يرجى إدخال رقم الهاتف وسنة الميلاد لإرسال رمز التحقق." };
          }
          const payload = {
            order_id: orderId,
            amount: amountLyd,
            mobile_number: userInput.mobile_number,
            birth_year: userInput.birth_year,
          };
          const { status, body } = await plutuRequest({ cfg, gateway, endpoint: "verify", payload });
          if (status === 200) {
            const processId = body?.result?.process_id;
            return {
              success: true,
              paymentId: orderId,
              nextStep: PaymentStatus.WAITING_FOR_VERIFICATION,
              message: "تم إرسال رمز التحقق إلى هاتفك. أدخل الرمز لإتمام الدفع.",
              data: { processId },
            };
          }
          return {
            success: false,
            message: body?.error?.message || "فشل إرسال رمز التحقق. حاول مرة أخرى.",
            data: body
          };
        }

        // لدينا OTP: نؤكد الدفع
        const processId = userInput?.processId || userInput?.process_id;
        if (!processId) {
          return { success: false, message: "معرّف العملية غير موجود. أعد طلب رمز التحقق." };
        }
        const payload = {
          code: userInput.otp,
          process_id: processId,
          amount: amountLyd,
          invoice_no: orderId,
          customer_ip: userInput?.customer_ip,
        };
        const { status, body } = await plutuRequest({ cfg, gateway, endpoint: "confirm", payload });
        if (status === 200) {
          return {
            success: true,
            paymentId: orderId,
            transactionId: body?.result?.transaction_id || crypto.randomUUID(),
            nextStep: PaymentStatus.COMPLETED,
            message: "تم الدفع بنجاح عبر بلوتو.",
          };
        }
        return {
          success: false,
          nextStep: PaymentStatus.FAILED,
          message: body?.error?.message || "فشل تأكيد الدفع. تأكد من رمز OTP وحاول مرة أخرى.",
        };
      }

      // قنوات إعادة التوجيه (MPGS / Tlync / Local Cards)
      const basePayload: Record<string, any> = {
        amount,
        invoice_no: orderId,
        return_url: userInput?.returnUrl,
        checkout_page: userInput?.checkout_page,
        customer_ip: userInput?.customer_ip,
        lang: userInput?.lang,
      };

      if (channel === "tlync") {
        // Tlync يتطلب رقم هاتف و callback_url
        if (!userInput?.mobile_number) {
          return { success: false, nextStep: PaymentStatus.FAILED, message: "رقم الهاتف مطلوب لقناة Tlync." };
        }
        basePayload.mobile_number = userInput.mobile_number;
        basePayload.email = userInput?.email;
        basePayload.callback_url = userInput?.callbackUrl || userInput?.returnUrl;
      }

      const { status, body } = await plutuRequest({ cfg, gateway, endpoint: "confirm", payload: basePayload });
      if (status === 200 && body?.result?.redirect_url) {
        return {
          success: true,
          paymentId: orderId,
          transactionId: body?.result?.transaction_id || crypto.randomUUID(),
          redirectUrl: body.result.redirect_url,
          nextStep: PaymentStatus.PENDING,
          message: "سيتم تحويلك لإتمام الدفع عبر بلوتو.",
          data: { redirectUrl: body.result.redirect_url },
        };
      }

      return {
        success: false,
        nextStep: PaymentStatus.FAILED,
        message: body?.error?.message || "فشل بدء عملية الدفع عبر بلوتو.",
        data: body,
      };
    },

    async verifyPayment(paymentId, verificationData, methodConfig) {
      // للتحقق اليدوي في حالة الـ OTP: إذا وصل otp لاحقاً
      const cfg = methodConfig as PlutuConfig;
      const gateway = channelMeta[channel].gateway;
      if (channel === "sadad" || channel === "edfali") {
        if (!verificationData?.otp) {
          return {
            success: false,
            status: PaymentStatus.FAILED,
            message: "رمز التحقق مفقود.",
          };
        }
        const processId = verificationData?.processId || verificationData?.process_id;
        if (!processId) {
          return { success: false, status: PaymentStatus.FAILED, message: "معرّف العملية مفقود." };
        }
        const payload = { code: verificationData.otp, process_id: processId };
        const { status, body } = await plutuRequest({ cfg, gateway, endpoint: "confirm", payload });
        if (status === 200) {
          return {
            success: true,
            status: PaymentStatus.COMPLETED,
            transactionId: body?.result?.transaction_id || crypto.randomUUID(),
            message: "تم التحقق من الدفع عبر بلوتو.",
          };
        }
        return { success: false, status: PaymentStatus.FAILED, message: body?.error?.message || "فشل التحقق من الدفع." };
      }

      // قنوات إعادة التوجيه: نعتمد على approved في معطيات العودة
      const hashResult = verifyPlutuHash(cfg.secretKey, verificationData || {}, channel);
      const approved = verificationData?.approved === 1 || verificationData?.approved === "1" || verificationData?.approved === true || verificationData?.approved === "true";
      const canceled = verificationData?.canceled === 1 || verificationData?.canceled === "1" || verificationData?.canceled === true || verificationData?.canceled === "true";
      const transactionId = verificationData?.transaction_id || verificationData?.transactionId;

      console.log('Plutu redirect verify:', {
        channel,
        paymentId,
        approved,
        canceled,
        hashValid: hashResult.valid,
        transactionId,
        hashDebug: hashResult.debug,
      });

      if (hashResult.valid && approved) {
        return {
          success: true,
          status: PaymentStatus.COMPLETED,
          transactionId: transactionId || crypto.randomUUID(),
          message: "تم الدفع بنجاح عبر بلوتو.",
          data: verificationData,
        };
      }
      if (canceled) {
        return { success: false, status: PaymentStatus.FAILED, message: "تم إلغاء العملية من قبل المستخدم." };
      }
      if (!hashResult.valid) {
        console.error('Plutu hash verification failed. Rejecting payment.', {
          paymentId,
          approved,
          transactionId,
          hashDebug: hashResult.debug,
        });
        return { success: false, status: PaymentStatus.FAILED, message: "فشل التحقق من سلامة بيانات بلوتو (Hash)." };
      }
      return { success: false, status: PaymentStatus.FAILED, message: "تعذر التحقق من عملية الدفع عبر بلوتو." };
    },

    async handleWebhook() {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        message: "لم يتم تنفيذ Webhook لبوابة بلوتو بعد.",
      };
    },
  };
}
