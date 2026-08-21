import { useQuery } from '@tanstack/react-query';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface OrderItem {
  id: string;
  orderId: string;
  imageUrl?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: string;
  // Some backends return `productName`, others `name`; support both.
  name?: string;
  productName?: string;
}

// Payment representation for client-side usage
export interface Payment {
  id: string;
  paymentMethod: string;
  amount: string;
  currency: string;
  status: string;
  transactionId?: string;
  paymentData?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  total: string;
  status: string;
  payment?: Payment; // include associated payment details
  createdAt: string;
  updatedAt: string;
  // Add tracking details
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface PaginatedOrdersResult {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useUserOrders(
  page: number = 1,
  limit: number = 10
) {
  return useQuery<PaginatedOrdersResult, Error>({
    queryKey: ['userOrders', page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/orders?page=${page}&limit=${limit}`);
      if (!res.ok) {
        throw new Error('خطأ في جلب الطلبات');
      }
      const json = await res.json();
      return json.data; // return only the paginated result
    },
  });
}

export function useOrder(orderId: string) {
  return useQuery<Order, Error>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        throw new Error('خطأ في جلب تفاصيل الطلب');
      }
      const json = await res.json();
      return json.data;
    },
  });
}
