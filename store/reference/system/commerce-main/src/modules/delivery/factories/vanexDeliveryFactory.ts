import { DeliveryMethod, DeliveryMethodCode, DeliveryOrderItem, ShippingStatus } from "../types/deliveryTypes";
import { db } from '@/lib/db/drizzle';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCache, setCache, deleteCache } from '@/modules/cache';
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";
import { updateOrderStatus } from '@/modules/orders/services/orderService';

/**
 * Factory function to create Vanex Delivery method instance
 * @param configData Configuration data for Vanex Delivery
 */
export function createVanexDeliveryMethod(configData: Record<string, any>): DeliveryMethod {
  const { baseUrl = 'https://app.vanex.ly/api/v1/', email, password, branchSubCityId } = configData;
  let token: string | null = null;

  async function authenticate(): Promise<string> {
    if (token) return token;
    // Try loading token from cache
    const cached = await getCache<string>('vanex:token');
    if (cached) {
      token = cached;
      return token;
    }
    const res = await fetch(`${baseUrl}/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });
    const json = await res.json();
    token = json.data?.access_token;
    // Cache new token
    await setCache('vanex:token', token);
    return token!;
  }

  // Wrapper that adds auth header and retries once on 405 by clearing cache
  async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
    let t = await authenticate();
    init.headers = { ...(init.headers || {}), Authorization: `Bearer ${t}` };
    let res = await fetch(input, init);
    if (res.status === 401) {
      // Token expired or invalid, clear and retry
      token = null;
      await deleteCache('vanex:token');
      t = await authenticate();
      init.headers = { ...(init.headers || {}), Authorization: `Bearer ${t}` };
      res = await fetch(input, init);
    }
    return res;
  }

  return {
    code: DeliveryMethodCode.VANEX,
    name: "ڤانيكس",
    isActive: true,
    configurationFields: [
      { name: "email", label: "البريد الإلكتروني", type: "text", required: true },
      { name: "password", label: "كلمة السر", type: "password", required: true },
      { name: "branchSubCityId", label: "معرف منطقة الفرع", type: "text", required: true },
    ],

    calculateDeliveryPrice: async (
      destinationCityId: string,
      destinationRegionId: string | null,
      orderDetails: { weight?: number; width?: number; height?: number; length?: number; price: number }
    ): Promise<{ success: boolean; price?: string; trackingNumber?: string; message?: string }> => {
      try {
        const params = new URLSearchParams({
          destination: destinationCityId,
          sub_city_id: destinationRegionId || '', // Handle null region
          sender_region: branchSubCityId,
          height: (orderDetails.height ?? 0).toString(),
          leangh: (orderDetails.length ?? 0).toString(),
          width: (orderDetails.width ?? 0).toString(),
          price: orderDetails.price.toString(),
          delivery_type: '1'
        });
        const res = await fetchWithAuth(`${baseUrl}/delivery-calculation?${params}`);
        const json = await res.json();
        if (json.errors) {
          return { success: false, message: json.message || 'خطأ في حساب التكلفة' };
        }
        return { success: true, price: json.delivery_price?.toString(), message: json.message };
      } catch (error) {
        console.error('Error Vanex calculateDeliveryPrice', error);
        return { success: false, message: 'حدث خطأ أثناء حساب تكلفة التوصيل' };
      }
    },

    listCities: async (): Promise<{ id: string; name: string }[]> => {
      try {
        const res = await fetchWithAuth(`${baseUrl}/city/names`);
        const json = await res.json();
        if (json.errors) {
          console.error("Error Vanex listCities response errors", json.message);
          return [];
        }
        return (json.data || []).map((c: any) => ({ id: c.id.toString(), name: c.name, code: c.code }));
      } catch (error) {
        console.error("Error Vanex listCities", error);
        return [];
      }
    },

    listRegions: async (cityId: string): Promise<{ id: string; name: string }[]> => {
      try {
        const res = await fetchWithAuth(`${baseUrl}/city/${cityId}/subs`);
        const json = await res.json();
        if (json.errors) {
          console.error("Error Vanex listRegions response errors", json.message);
          return [];
        }
        // Utilities returns data.data array
        return (json.data?.data || []).map((r: any) => ({ id: r.id.toString(), name: r.name }));
      } catch (error) {
        console.error("Error Vanex listRegions", error);
        return [];
      }
    },

    // Create and start delivery via Vanex package endpoint with static defaults
    startDelivery: async (
      params: {
        orderId: string;
        orderNumber: string;
        destinationCityId: string;
        destinationRegionId: string | null;
        address: string;
        contactName: string;
        contactPhone: string;
        paymentMethod: string; // Payment method code
        orderDetails: { qty?: number; weight?: number; width?: number; height?: number; length?: number; price: number };
        items?: DeliveryOrderItem[];
      }
    ): Promise<{ success: boolean; trackingNumber?: string; message?: string }> => {
      try {
        // Build payload for package creation
        const payload = {
          type: 1,
          description: `Order #${params.orderId}`,
          qty: params.orderDetails.qty ?? 1,
          leangh: params.orderDetails.length ?? 0,
          width: params.orderDetails.width ?? 0,
          height: params.orderDetails.height ?? 0,
          breakable: 0,
          measuring_is_allowed: true,
          inspection_allowed: true,
          heat_intolerance: true,
          casing: false,
          address: params.address,
          reciever: params.contactName,
          phone: params.contactPhone,
          phone_b: params.contactPhone,
          city: Number(params.destinationCityId),
          address_child: params.destinationRegionId ? Number(params.destinationRegionId) : null,
          price: params.orderDetails.price,
          sticker_notes: "",
          paid_by: (params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY) ? "customer" : "market",
          extra_size_by: (params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY) ? "customer" : "market",
          commission_by: (params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY) ? "customer" : "market",
          payment_method: (params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY) ? "cash" : "cheque",
          map: "",
          package_sub_type: 6,
          type_id: 1
        } as Record<string, any>;
        const res = await fetchWithAuth(`${baseUrl}/customer/package`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.errors || json.status_code !== 201) {
          return { success: false, message: json.message || 'خطأ في إنشاء الشحنة' };
        }
        return { success: true, trackingNumber: json.package_code, message: json.message };
      } catch (error) {
        console.error('Error Vanex startDelivery', error);
        return { success: false, message: 'حدث خطأ أثناء إنشاء الشحنة' };
      }
    },

    // Retrieve package details by package code
    getPackage: async (
      packageCode: string
    ): Promise<{ success: boolean; data?: any; message?: string }> => {
      try {
        const res = await fetchWithAuth(`${baseUrl}/customer/packages/${packageCode}`);
        const json = await res.json();
        if (!json.data) {
          return { success: false, message: json.message || "خطأ في جلب بيانات البوليصة" };
        }
        return { success: true, data: json.data, message: json.message };
      } catch (error) {
        console.error("Error Vanex getPackage", error);
        return { success: false, message: "حدث خطأ أثناء جلب بيانات البوليصة" };
      }
    },
    // Get all packages with pagination and optional status filter
    getAllPackages: async (
      params: { page?: number; perPage?: number; status?: string }
    ): Promise<{ success: boolean; data?: any; message?: string }> => {
      try {
        const query = `?page=${params.page ?? 1}&per-page=${params.perPage ?? 10}${params.status ? `&status=${params.status}` : ''}`;
        const res = await fetchWithAuth(`${baseUrl}/customer/package${query}`);
        const json = await res.json();
        if (json.errors) {
          return { success: false, message: json.message || 'خطأ في جلب الطلبات' };
        }
        return { success: true, data: json.data, message: json.message };
      } catch (error) {
        console.error('Error Vanex getAllPackages', error);
        return { success: false, message: 'حدث خطأ أثناء جلب الطلبات' };
      }
    },

    handleWebhook: async (payload: Record<string, any>, headers: Record<string, string>, configData: Record<string, any>, _rawBody?: string): Promise<{ success: boolean }> => {
      try {
        const { type: rawType, packages } = payload;
        // Map provider-specific event types to generic statuses
        const statusMap: Record<string, ShippingStatus> = {
          "package_accepted": ShippingStatus.Accepted,
          "package_delivered": ShippingStatus.Delivered,
          "package_storage_return": ShippingStatus.Returned,
          "bundle_returns": ShippingStatus.Returned,
        };
        const status = statusMap[rawType] || (rawType as ShippingStatus);
        // Map delivery status to order status if needed
        let orderStatusStr: string | undefined = undefined;
        if (status === ShippingStatus.Delivered) {
          orderStatusStr = 'delivered';
        } else if (status === ShippingStatus.Returned) {
          orderStatusStr = 'cancelled';
        } else if (status === ShippingStatus.Accepted) {
          orderStatusStr = 'shipped';
        }

        // Update each referenced order
        for (const pkg of packages || []) {
          const refId = pkg.store_reference_id?.toString();
          const code = pkg.code;
          if (refId) {
            const orderByRef = await db.query.orders.findFirst({
              where: eq(orders.referenceId, refId)
            });
            if (orderByRef) {
              await updateOrderStatus(orderByRef.id, {
                shippingStatus: status,
                status: orderStatusStr,
              });
              if (code && code !== orderByRef.trackingNumber) {
                await db.update(orders).set({ trackingNumber: code }).where(eq(orders.id, orderByRef.id));
              }
            }
          }
        }
        return { success: true };
      } catch (error) {
        console.error('Error Vanex handleWebhook', error);
        return { success: false };
      }
    }
  };
}
