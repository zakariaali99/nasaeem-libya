import { DeliveryMethod, DeliveryMethodCode, DeliveryOrderItem, ShippingStatus } from "../types/deliveryTypes";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";
import { db } from "@/lib/db/drizzle";
import { orders, cities, regions } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { createHash, timingSafeEqual } from "crypto";
import { updateOrderStatus } from '@/modules/orders/services/orderService';

/**
 * Factory function to create Darb Sabeel Delivery method instance
 */
export function createDarbSabeelDeliveryMethod(configData: Record<string, any>): DeliveryMethod {
  const {
    baseUrl = "https://v2.sabil.ly",
    apiKey,
    apiVersion = "1.0.0",
    accountId,
    account_id,
    accountID,
    serviceId,
    defaultCurrency = "LYD",
    webhookSecret,
  } = configData;

  // Normalize account id (supports different casing from stored configs)
  const normalizedAccountId = (accountId || account_id || accountID || "").toString().trim();
  const normalizedServiceId = (serviceId ?? "").toString().trim();
  const normalizedCurrency = (defaultCurrency ?? "LYD").toString().trim();
  const currencyForApi = /^[A-Za-z]{3}$/.test(normalizedCurrency)
    ? normalizedCurrency.toLowerCase()
    : "lyd";

  // Build common headers for Darb Sabeel API using Headers to avoid casing/merge issues
  function buildHeaders(extra: HeadersInit = {}): Headers {
    if (!apiKey || !normalizedAccountId) {
      throw new Error("Darb Sabeel headers missing apiKey or accountId");
    }

    const headers = new Headers();
    headers.set("Accept", "application/json, text/plain, */*");
    headers.set("Content-Type", "application/json");
    headers.set("Accept-Language", "ar");
    headers.set("Authorization", `apikey ${apiKey}`);
    headers.set("x-api-version", apiVersion);
    headers.set("x-account-id", normalizedAccountId);

    const extraHeaders = new Headers(extra);
    extraHeaders.forEach((value, key) => headers.set(key, value));

    return headers;
  }

  async function request(path: string, init: RequestInit = {}) {
    if (!apiKey || !normalizedAccountId) {
      throw new Error("Darb Sabeel request missing apiKey or accountId");
    }
    const headers = buildHeaders(init.headers || {});

    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Darb Sabeel request failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  function normalizeLibyanPhoneNumber(phone: string): string {
    if (!phone) return "";
    let clean = phone.replace(/[^\d+]/g, "");
    if (clean.startsWith("+218")) return clean;
    if (clean.startsWith("00218")) return `+218${clean.slice(5)}`;
    if (clean.startsWith("218")) return `+${clean}`;
    if (clean.startsWith("0") && clean.length >= 10) return `+218${clean.slice(1)}`;
    if (/^\d{9}$/.test(clean)) return `+218${clean}`;
    return `+218${clean}`;
  }

  // Fetch service rates to build city/area mappings and pricing
  async function fetchPublicServiceRates(): Promise<any[]> {
    if (!apiKey || !normalizedAccountId) {
      console.warn("[DarbSabeel] Skipping rates fetch: apiKey/accountId not configured");
      return [];
    }
    try {
      const query = `?limit=500&includeTotalCount=false`;
      // Only append serviceId if it is a valid ObjectId (24 hex chars)
      const json = await request(`/api/local/branches/public${query}`);
      if (json?.status && Array.isArray(json.data?.results)) {
        return json.data.results;
      }
      return [];
    } catch (error) {
      console.error("[DarbSabeel] fetchPublicServiceRates error", error);
      return [];
    }
  }

  return {
    code: DeliveryMethodCode.DARB_SABEEL,
    name: "درب السبيل",
    isActive: true,
    configurationFields: [
      { name: "apiKey", label: "مفتاح الـ API", type: "text", required: true },
      { name: "accountId", label: "معرف الحساب", type: "text", required: true },
      { name: "serviceId", label: "معرف الخدمة", type: "text", required: false },
      { name: "apiVersion", label: "إصدار الـ API", type: "text", required: true },
      { name: "webhookSecret", label: "سر الويب هوك", type: "password", required: true },
      { name: "baseUrl", label: "الرابط الأساسي", type: "text", required: false },
      { name: "defaultCurrency", label: "العملة", type: "text", required: false },
    ],

    async calculateDeliveryPrice(destinationCityId, destinationRegionId, orderDetails) {
      try {
        // Resolve city code/name if possible
        let cityIdentifier = destinationCityId;
        const city = await db.query.cities.findFirst({
          where: eq(cities.id, destinationCityId),
          columns: { code: true, name: true }
        });
        if (city) {
          cityIdentifier = city.code || city.name;
        }

        // Resolve region name
        let regionIdentifier = destinationRegionId;
        if (destinationRegionId) {
          const region = await db.query.regions.findFirst({
            where: eq(regions.id, destinationRegionId),
            columns: { name: true }
          });
          if (region) {
            regionIdentifier = region.name;
          }
        }

        const rates = await fetchPublicServiceRates();
        const byCity = rates.find((r: any) => r.city === cityIdentifier);
        const area = byCity?.areas?.find((a: any) => a.area === regionIdentifier);
        const price = area?.deliveryRate ?? byCity?.deliveryRate;
        if (price !== undefined) {
          return { success: true, price: price.toString(), message: "تم حساب تكلفة التوصيل" };
        }
        return { success: false, message: "تعذر إيجاد تسعيرة للتوصيل" };
      } catch (error) {
        console.error("[DarbSabeel] calculateDeliveryPrice error", error);
        return { success: false, message: "حدث خطأ أثناء حساب تكلفة التوصيل" };
      }
    },

    async listCities() {
      const rates = await fetchPublicServiceRates();
      const unique = new Map<string, string>();
      for (const rate of rates) {
        if (rate.city && !unique.has(rate.city)) unique.set(rate.city, rate.city);
      }
      return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
    },

    async listRegions(cityId: string) {
      const rates = await fetchPublicServiceRates();
      const regions: { id: string; name: string }[] = [];
      const matching = rates.filter((r: any) => r.city === cityId);
      for (const m of matching) {
        for (const area of m.areas || []) {
          if (area.area) regions.push({ id: area.area, name: area.area });
        }
      }
      return regions;
    },

    async startDelivery(params) {
      try {
        if (!apiKey || !normalizedAccountId) {
          return { success: false, message: "إعدادات درب السبيل غير مكتملة" };
        }
        console.log("[DarbSabeel] Starting delivery with params:", params);

        // Resolve city code/name if possible
        let cityIdentifier = params.destinationCityId;
        if (params.destinationCityId) {
          const city = await db.query.cities.findFirst({
            where: eq(cities.id, params.destinationCityId),
            columns: { code: true, name: true }
          });
          if (city) {
            cityIdentifier = city.code || city.name;
          }
        }

        // Resolve region name
        let regionIdentifier = params.destinationRegionId ?? "";
        if (params.destinationRegionId) {
          const region = await db.query.regions.findFirst({
            where: eq(regions.id, params.destinationRegionId),
            columns: { name: true }
          });
          if (region) {
            regionIdentifier = region.name;
          }
        }
        console.log("[DarbSabeel] Resolved city/region:", cityIdentifier, regionIdentifier);

        const phone = normalizeLibyanPhoneNumber(params.contactPhone);
        const contactPayload = {
          account: normalizedAccountId,
          name: params.contactName,
          phone,
        };

        const contactRes = await request(`/api/contacts/create/public/contact`, {
          method: "POST",
          body: JSON.stringify(contactPayload),
        });
        const contactId = contactRes?.data?._id;
        console.log("[DarbSabeel] Created contact:", contactId);
        if (!contactId) {
          return { success: false, message: "تعذر إنشاء جهة الاتصال للعميل" };
        }

        const amountNumber = Number(params.orderDetails.price ?? 0);
        const safeAmount = Number.isFinite(amountNumber) ? amountNumber : 0;

        // Build products list from order items when available; fallback to single summary item otherwise
        const products = (params.items && params.items.length ? params.items : [{
          title: `طلب #${params.orderNumber}`,
          quantity: params.orderDetails.qty ?? 1,
          metadata: params.orderDetails,
          price: safeAmount,
        }]).map((item) => {
          const meta = (item as DeliveryOrderItem)?.metadata || (item as any)?.metadata || {};
          const width = Number((meta as any).width ?? (meta as any).widthCM ?? 7);
          const height = Number((meta as any).height ?? (meta as any).heightCM ?? 13);
          const length = Number((meta as any).length ?? (meta as any).lengthCM ?? 18);
          const price = Number((item as DeliveryOrderItem).price ?? (meta as any).price ?? safeAmount);
          const quantity = Number((item as DeliveryOrderItem).quantity ?? (item as any).quantity ?? 1);
          const name = (item as DeliveryOrderItem).name || (item as DeliveryOrderItem).variantTitle || (item as any).title;
          return {
            title: name || `طلب #${params.orderNumber}`,
            quantity: Number.isFinite(quantity) ? quantity : 1,
            widthCM: Number.isFinite(width) ? width : 40,
            heightCM: Number.isFinite(height) ? height : 40,
            lengthCM: Number.isFinite(length) ? length : 50,
            amount: Number.isFinite(price) ? price : safeAmount,
            currency: currencyForApi,
            isChargeable: params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY,
          };
        });

        const payload: Record<string, any> = {
          notes: `طلب ${params.orderNumber}`,
          contacts: contactId ? [contactId] : [],
          products,
          allowSplitting: false,
          paymentBy: (params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY) ? "receiver" : "sender",
          to: {
            countryCode: "lby",
            city: cityIdentifier,
            area: regionIdentifier,
            address: params.address,
          },
          allowCardPayment: params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY,
          metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
        };

        // أضف حقل الخدمة فقط إذا كان ObjectId صالحًا لتفادي خطأ InstanceOf
        if (normalizedServiceId && /^[0-9a-fA-F]{24}$/.test(normalizedServiceId)) {
          payload.service = normalizedServiceId;
        } else {
          // ضمان عدم إرسال قيمة غير صالحة
          if (payload.service) delete (payload as any).service;
        }

        const shipmentRes = await request(`/api/local/shipments`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        console.log("[DarbSabeel] Created shipment:", shipmentRes);

        const tracking = shipmentRes?.data?.reference || shipmentRes?.data?._id;
        if (shipmentRes?.status && tracking) {
          return { success: true, trackingNumber: tracking, message: "تم إنشاء الشحنة بنجاح" };
        }
        console.log("[DarbSabeel] Failed to create shipment:", shipmentRes);
        const message = shipmentRes?.messages?.[0]?.message || "فشل في إنشاء الشحنة";
        return { success: false, message };
      } catch (error) {
        console.error("[DarbSabeel] startDelivery error", error);
        return { success: false, message: "حدث خطأ أثناء إنشاء الشحنة" };
      }
    },

    async handleWebhook(payload, headers, _config, rawBody) {
      try {
        // Verify signature if secret is set
        if (webhookSecret) {
          const received = headers["x-payload-signature"] || headers["X-Payload-Signature"];
          if (!received) {
            console.error("[DarbSabeel] Missing signature header");
            return { success: false };
          }
          const bodyToHash = rawBody || JSON.stringify(payload);
          const computed = createHash("sha256")
            .update(`${bodyToHash}:${webhookSecret}`, "utf8")
            .digest("hex");
          const ok = timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(received, "hex"));
          if (!ok) {
            console.error("[DarbSabeel] Invalid webhook signature");
            return { success: false };
          }
        }

        const ref = payload?.reference || payload?.trackingNumber || payload?._id;
        const rawStatus: string = payload?.status || payload?.to_status || "";

        const status = (() => {
          const s = (rawStatus || "").toLowerCase();
          if (s.includes("deliver") || s.includes("complete")) return ShippingStatus.Delivered;
          if (s.includes("return")) return ShippingStatus.Returned;
          if (s.includes("cancel")) return ShippingStatus.Cancelled;
          return ShippingStatus.Accepted;
        })();

        // Map delivery status to order status if needed
        let orderStatusStr: string | undefined = undefined;
        if (status === ShippingStatus.Delivered) {
          orderStatusStr = 'delivered';
        } else if (status === ShippingStatus.Returned || status === ShippingStatus.Cancelled) {
          orderStatusStr = 'cancelled';
        } else if (status === ShippingStatus.Accepted) {
          orderStatusStr = 'shipped';
        }

        if (ref) {
          const matchingOrder = await db.query.orders.findFirst({
            where: or(eq(orders.trackingNumber, ref), eq(orders.referenceId, ref))
          });

          if (matchingOrder) {
            await updateOrderStatus(matchingOrder.id, {
              shippingStatus: status,
              status: orderStatusStr,
            });
            if (ref && ref !== matchingOrder.trackingNumber) {
              await db.update(orders).set({ trackingNumber: ref }).where(eq(orders.id, matchingOrder.id));
            }
          }
        }
        return { success: true };
      } catch (error) {
        console.error("[DarbSabeel] handleWebhook error", error);
        return { success: false };
      }
    },
  };
}
