// Delivery module types
export enum DeliveryMethodCode {
  // Add other provider codes here
  VANEX = "vanex",
  NAWRES = "nawres",
  DARB_SABEEL = "darb_sabeel",
}

// Generic shipping statuses for all providers
export enum ShippingStatus {
  Accepted = "accepted",
  Delivered = "delivered",
  Returned = "returned", // Generic return status
  Cancelled = "cancelled", // Generic cancellation status
}

export type DeliveryOrderItem = {
  productId: string;
  variantId?: string | null;
  name?: string;
  variantTitle?: string | null;
  quantity: number;
  price?: string | number;
  metadata?: Record<string, any> | null;
};

export interface DeliveryMethodConfigField {
  name: string;
  label: string; // Arabic label for UI
  type: "text" | "number" | "boolean" | "password";
  required: boolean;
}

export interface DeliveryMethod {
  code: DeliveryMethodCode;
  name: string; // Arabic name for UI
  isActive: boolean;
  configurationFields: DeliveryMethodConfigField[];
  userInputFields?: DeliveryMethodConfigField[];
  calculateDeliveryPrice: (
    destinationCityId: string,
    destinationRegionId: string | null,
    orderDetails: {
      weight?: number;
      width?: number;
      height?: number;
      length?: number;
      qty?: number;
      price: number;
    }
  ) => Promise<{
    success: boolean;
    price?: string;
    trackingNumber?: string;
    message?: string; // Arabic message
  }>;
  listCities: () => Promise<{id: string; name: string}[]>; // List of cities with id and name
  listRegions: (cityId: string) => Promise<{id: string; name: string}[]>; // Optional method to list regions by city
  startDelivery: (
    params: {
      orderId: string;
      orderNumber: string;
      destinationCityId: string;
      destinationRegionId: string | null;
      address: string;
      contactName: string;
      contactPhone: string;
      paymentMethod: string; // Payment method code
      orderDetails: {
        weight?: number;
        width?: number;
        height?: number;
        length?: number;
        qty?: number;
        price: number;
      };
      items?: DeliveryOrderItem[];
    }
  ) => Promise<{
    success: boolean;
    trackingNumber?: string;
    message?: string; // Arabic message
  }>;
  // Retrieves package details by its code
  getPackage?: (packageCode: string) => Promise<{ success: boolean; data?: any; message?: string }>;
  // Get all packages with pagination and optional status filter
  getAllPackages?: (params: { page?: number; perPage?: number; status?: string }) => Promise<{ success: boolean; data?: any; message?: string }>;
  handleWebhook?: (
    payload: Record<string, any>,
    headers: Record<string, string>,
    configData: Record<string, any>,
    rawBody?: string,
  ) => Promise<{ success: boolean }>;
}

export interface DeliveryMethodConfiguration {
  id: string; // UUID
  code: DeliveryMethodCode;
  name: string; // Arabic name
  configuration: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}