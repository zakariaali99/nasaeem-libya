import { DeliveryMethod, DeliveryMethodCode, DeliveryOrderItem } from '../types/deliveryTypes';
import { PaymentMethodCode } from '@/modules/payments/types/paymentTypes';
import { db } from '@/lib/db/drizzle';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateOrderStatus } from '@/modules/orders/services/orderService';

/**
 * Factory function to create Nawres Delivery method instance
 * @param configData Configuration data for Nawres Delivery
 */
export function createNawresDeliveryMethod(configData: Record<string, any>): DeliveryMethod {
  const {
    baseUrl = 'https://backoffice.nawris.algoriza.com/external-api/',
    authentication_key,
    main_client_code
  } = configData;

  // Helper function to make API requests with proper headers
  async function fetchWithHeaders(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    return fetch(url, {
      ...options,
      headers
    });
  }

  // Helper function to normalize phone numbers to Libyan format (+218...)
  function normalizeLibyanPhoneNumber(phone: string): string {
    if (!phone) return '';

    // Remove all non-digit characters except the plus sign
    let cleanPhone = phone.replace(/[^\d+]/g, '');

    // Handle different formats:
    // 1. If it starts with +218, it's already correct
    if (cleanPhone.startsWith('+218')) {
      return cleanPhone;
    }

    // 2. If it starts with 00218, replace with +218
    if (cleanPhone.startsWith('00218')) {
      return '+218' + cleanPhone.substring(5);
    }

    // 3. If it starts with 218, add the + sign
    if (cleanPhone.startsWith('218')) {
      return '+' + cleanPhone;
    }

    // 4. If it starts with 0 (local format like 0917343924), remove 0 and add +218
    if (cleanPhone.startsWith('0') && cleanPhone.length >= 10) {
      return '+218' + cleanPhone.substring(1);
    }

    // 5. If it's just digits without country code (like 917343924), add +218
    if (/^\d{9}$/.test(cleanPhone)) {
      return '+218' + cleanPhone;
    }

    // 6. If none of the above, assume it needs +218 prefix
    return '+218' + cleanPhone;
  }

  return {
    code: DeliveryMethodCode.NAWRES,
    name: "نوارس",
    isActive: true,
    configurationFields: [
      { name: "authentication_key", label: "مفتاح المصادقة", type: "text", required: true },
      { name: "main_client_code", label: "كود المتجر الرئيسي", type: "text", required: true },
    ],

    calculateDeliveryPrice: async (
      destinationCityId: string,
      destinationRegionId: string | null,
      orderDetails: { weight?: number; width?: number; height?: number; length?: number; price: number }
    ): Promise<{ success: boolean; price?: string; trackingNumber?: string; message?: string }> => {
      try {
        // First try to get area cost if regionId is provided
        if (destinationRegionId) {
          const areaParams = new URLSearchParams({
            authentication_key,
            type: '1',
            area_id: destinationRegionId
          });

          const areaRes = await fetchWithHeaders(`${baseUrl}get-area-cost?${areaParams}`);
          const areaJson = await areaRes.json();

          if (areaJson.success === 1 && areaJson.feed) {
            return {
              success: true,
              price: areaJson.feed.toString(),
              message: 'تم حساب سعر التوصيل للمنطقة بنجاح'
            };
          }
        }

        // Use city cost when no region is provided or region lookup failed
        const cityParams = new URLSearchParams({
          authentication_key,
          type: '1',
          government_id: destinationCityId
        });

        const cityRes = await fetchWithHeaders(`${baseUrl}get-cost?${cityParams}`);
        const cityJson = await cityRes.json();

        if (cityJson.success === 1 && cityJson.feed) {
          return {
            success: true,
            price: cityJson.feed.toString(),
            message: 'تم حساب سعر التوصيل للمدينة بنجاح'
          };
        }

        return { success: false, message: cityJson.error_msg || 'فشل في حساب تكلفة التوصيل' };
      } catch (error) {
        console.error('Error Nawres calculateDeliveryPrice', error);
        return { success: false, message: 'حدث خطأ أثناء حساب تكلفة التوصيل' };
      }
    },

    listCities: async (): Promise<{ id: string; name: string }[]> => {
      try {
        const params = new URLSearchParams({
          authentication_key
        });

        const res = await fetchWithHeaders(`${baseUrl}get-government?${params}`);
        const json = await res.json();

        if (json.success === 1 && json.feed) {
          return json.feed.map((city: any) => ({
            id: city.id.toString(),
            name: city.name
          }));
        }

        return [];
      } catch (error) {
        console.error("Error Nawres listCities", error);
        return [];
      }
    },

    listRegions: async (cityId: string): Promise<{ id: string; name: string }[]> => {
      try {
        const params = new URLSearchParams({ authentication_key });
        const res = await fetchWithHeaders(`${baseUrl}get-area/${cityId}?${params}`);
        const json = await res.json();
        console.log(`[listRegions] Received response for city ${cityId}:`, json);
        // Defensive: ensure feed is an array
        if (json.success === 1 && Array.isArray(json.feed)) {
          return json.feed.map((region: any) => ({
            id: region.id?.toString() ?? '',
            name: region.name ?? ''
          }));
        }
        return [];
      } catch (error) {
        console.error("Error Nawres listRegions", error);
        return [];
      }
    },

    startDelivery: async (
      params: {
        orderId: string;
        orderNumber: string;
        destinationCityId: string;
        destinationRegionId: string | null;
        address: string;
        contactName: string;
        contactPhone: string;
        paymentMethod: string;
        orderDetails: { qty?: number; weight?: number; width?: number; height?: number; length?: number; price: number };
        items?: DeliveryOrderItem[];
      }
    ): Promise<{ success: boolean; trackingNumber?: string; message?: string }> => {
      try {
        // Normalize the phone number to the required format (+218...)
        const normalizedPhone = normalizeLibyanPhoneNumber(params.contactPhone);
        console.log(`[startDelivery] Normalized phone from "${params.contactPhone}" to "${normalizedPhone}"`);

        // Get city name from city ID
        const cities = await fetchWithHeaders(`${baseUrl}get-government?${new URLSearchParams({ authentication_key })}`);
        const citiesData = await cities.json();
        const cityName = citiesData.feed?.find((c: any) => c.id.toString() === params.destinationCityId)?.name || '';

        // Get area name from region ID if provided
        let areaName = '';
        if (params.destinationRegionId && cityName) {
          const areas = await fetchWithHeaders(`${baseUrl}get-area/${params.destinationCityId}?${new URLSearchParams({ authentication_key })}`);
          const areasData = await areas.json();
          areaName = areasData.feed?.find((a: any) => a.id.toString() === params.destinationRegionId)?.name || '';
        }

        // Only collect money from customer for pay-on-delivery methods; online payments are already paid
        const isPayOnDelivery = params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY;

        // Build payload for order creation
        const payload = {
          authentication_key,
          main_client_code,
          remote_order_id: params.orderNumber,
          second_client: "", // Optional
          receiver: params.contactName,
          phone1: normalizedPhone,
          government: cityName,
          area: areaName,
          address: params.address,
          notes: `Address #${params.address}`,
          invoice_number: params.orderNumber,
          order_summary: `Order #${params.orderNumber}`,
          amount_to_be_collected: isPayOnDelivery ? params.orderDetails.price : 0,
          return_amount: 0,
          is_order: 0, // Normal delivery with collection
          return_summary: "",
          is_office_given: 0, // Normal delivery (not office pickup)
          shipment_on_sender: (params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY) ? 0 : 1, // 0 = customer pays shipping, 1 = store pays
          extra_cost_payer: (params.paymentMethod === PaymentMethodCode.MANUAL_PAYMENT || params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY) ? 0 : 1,
          is_fragile: 0, // Not fragile by default
          can_open: 1, // Can be opened
          is_measurable: 1, // Can be measured
          is_bank_payment: params.paymentMethod === PaymentMethodCode.BANK_CARDS_ON_DELIVERY ? 1 : 0, // 1 for bank payment, 0 otherwise
          payment_commission_payer: 1, // 1 = sender, 2 = receiver
          pieces_count: params.orderDetails.qty || 1,
        };

        console.log(`[startDelivery] Sending request to Nawres for order ${params.orderId}:`, JSON.stringify(payload, null, 2));

        const res = await fetchWithHeaders(`${baseUrl}add-order`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        const textResponse = await res.text();
        console.log(`[startDelivery] Raw Nawres response for order ${params.orderId}:`, textResponse);

        let json;
        try {
          json = JSON.parse(textResponse);
        } catch (e) {
          console.error(`[startDelivery] Failed to parse Nawres response as JSON for order ${params.orderId}:`, textResponse);
          return { success: false, message: 'استجابة غير صالحة من شركة التوصيل' };
        }

        const resultCode = json.code ?? json.result?.code;
        const resultBarCode = json.bar_code ?? json.result?.bar_code;
        const resultInvoice = json.invoice_number ?? json.result?.invoice_number;

        if (resultCode || resultBarCode) {
          const trackingNumber = String(resultCode ?? resultBarCode ?? '');
          console.log(`[startDelivery] Successfully created shipment for order ${params.orderId}: tracking=${trackingNumber}, barcode=${resultBarCode}, invoice=${resultInvoice}`);
          return {
            success: true,
            trackingNumber: trackingNumber,
            message: 'تم إنشاء الشحنة بنجاح'
          };
        }

        return {
          success: false,
          message: json.error_msg || json.result?.error_msg || 'فشل في إنشاء الشحنة'
        };
      } catch (error) {
        console.error('Error Nawres startDelivery', error);
        return { success: false, message: 'حدث خطأ أثناء إنشاء الشحنة' };
      }
    },

    handleWebhook: async (
      payload: Record<string, any>,
      headers: Record<string, string>,
      configData: Record<string, any>,
      _rawBody?: string,
    ): Promise<{ success: boolean }> => {
      try {
        console.log('Nawres webhook received:', payload);

        // Extract data from the webhook payload based on Nawres API documentation
        const {
          order_code,
          from_status_code,
          to_status_code,
          from_status_text,
          to_status_text,
          order_price,
          order_type,
          return_reason,
          delay_reason,
          mission_code,
          remote_order_id
        } = payload;

        if (!order_code && !remote_order_id) {
          console.error('No order_code or remote_order_id provided in webhook payload');
          return { success: false };
        }

        // Map Nawres status codes to our shipping statuses
        const statusMap: Record<number, string> = {
          1: "saved_before_delivery", // محفوظة قبل التوصيل
          2: "sent_for_delivery", // مرسلة للتوصيل
          3: "at_company", // في الشركة
          4: "with_courier", // مع المندوب
          5: "returned_with_company", // مرتجع مع الشركة
          6: "return_received", // مرتجع تم استلامه
          7: "delivered", // تم التسليم
          8: "settled", // تم التسوية
          9: "deleted", // محذوفة
          10: "return_resent", // مرتجع معاد إرساله
          11: "return_lost", // مرتجع مفقود
          12: "return_missing", // مرتجع معدوم
          13: "delayed_with_courier", // مؤجلة مع المندوب
          14: "to_courier", // إلي المندوب
          15: "return_with_courier", // مرتجع مع المندوب
          16: "en_route_to_branch", // بالطريق للفرع
          17: "at_branch", // في الفرع
          18: "back_to_branch", // راجع الى الفرع
          19: "return_at_branch", // مرتجع في الفرع
          20: "assigned_to_courier", // معينة للمندوب
        };

        const newStatus = statusMap[to_status_code];
        if (!newStatus) {
          console.warn(`Unknown Nawres status code: ${to_status_code}`);
        }

        // Find the order by tracking number (order_code) or by remote_order_id
        let orderToUpdate;

        if (order_code) {
          // First try to find by tracking number
          const orderByTracking = await db.query.orders.findFirst({
            where: eq(orders.trackingNumber, order_code)
          });
          orderToUpdate = orderByTracking;
        }

        if (!orderToUpdate && remote_order_id) {
          // If not found by tracking number, try by remote_order_id (which could be orderNumber)
          const orderByRemoteId = await db.query.orders.findFirst({
            where: eq(orders.orderNumber, remote_order_id.toString())
          });
          orderToUpdate = orderByRemoteId;
        }

        if (!orderToUpdate) {
          console.error(`Order not found for order_code: ${order_code}, remote_order_id: ${remote_order_id}`);
          return { success: false };
        }

        const updateData: any = {};

        if (newStatus) {
          updateData.shippingStatus = newStatus;
        }

        // Update order status based on shipping status
        if (to_status_code === 7) { // تم التسليم
          updateData.status = 'delivered';
        } else if ([5, 6, 10, 11, 12, 15, 19].includes(to_status_code)) { // Return statuses
          updateData.status = 'cancelled'; // or 'returned' depending on your order status enum
        } else if ([2, 3, 4, 14, 16, 17, 20].includes(to_status_code)) { // In transit statuses
          updateData.status = 'shipped';
        }

        await updateOrderStatus(orderToUpdate.id, updateData);

        // Set tracking number if not already set and order_code is provided
        if (order_code && !orderToUpdate.trackingNumber) {
          await db.update(orders).set({ trackingNumber: order_code }).where(eq(orders.id, orderToUpdate.id));
        }

        console.log(`Successfully updated order ${orderToUpdate.orderNumber} with status: ${updateData.status}, shippingStatus: ${updateData.shippingStatus}, tracking: ${order_code}`);

        // Log additional information if provided
        if (return_reason) {
          console.log(`Return reason for order ${orderToUpdate.orderNumber}: ${return_reason}`);
        }
        if (delay_reason) {
          console.log(`Delay reason for order ${orderToUpdate.orderNumber}: ${delay_reason}`);
        }

        return { success: true };
      } catch (error) {
        console.error('Error handling Nawres webhook', error);
        return { success: false };
      }
    }
  };
}