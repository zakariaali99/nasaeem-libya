import { z } from 'zod';
import { PaymentStatus } from '@/modules/payments/types/paymentTypes';
// Order status enumeration
export enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

// Order item representation
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  price: string;
  imageUrl?: string;
  productName: string;
  variantTitle?: string;
}

// Add payment representation associated with an order
export interface Payment {
  id: string;
  paymentMethod: string;
  amount: string;
  currency: string;
  status: string;
  transactionId?: string;
  paymentData?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Order representation
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName?: string;
  items: OrderItem[];
  total: string;
  walletAmountUsed?: string;
  status: OrderStatus;
  shippingStatus?: string; // Add shippingStatus
  payment?: Payment; // include associated payment details
  createdAt: Date;
  updatedAt: Date;

  // Add tracking details
  trackingNumber?: string;
  trackingUrl?: string;
}

// Pagination parameters for listing orders
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Paginated orders result
export interface PaginatedOrdersResult {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Input schema for updating order status
export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  shippingStatus: z.nativeEnum(OrderStatus).optional(), // using OrderStatus enum or string if we prefer
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
