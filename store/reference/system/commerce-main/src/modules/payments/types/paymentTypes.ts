export enum PaymentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
  WAITING_FOR_VERIFICATION = "waiting_for_verification",
}

export enum PaymentMethodCode {
  BINANCE_PAY = "binance_pay",
  MANUAL_PAYMENT = "manual_payment",
  SADAD_PAY = "sadad_pay",
  MOAMALAT = "moamalat",
  PLUTU = "plutu",
  PLUTU_SADAD = "plutu_sadad",
  PLUTU_EDFALI = "plutu_edfali",
  PLUTU_MPGS = "plutu_mpgs",
  PLUTU_TLYNC = "plutu_tlync",
  PLUTU_LOCAL_CARDS = "plutu_local_cards",
  BANK_CARDS_ON_DELIVERY = "bank_cards_on_delivery",
  WALLET = "wallet",
}

export interface PaymentMethodConfigField {
  name: string;
  label: string; // Arabic label for UI
  type: "text" | "number" | "boolean" | "password";
  required: boolean;
  isSecure?: boolean;
}

export interface PaymentMethod {
  code: PaymentMethodCode;
  name: string; // User-facing name in Arabic
  description?: string; // User-facing description in Arabic
  isEnabled: boolean;
  configurationFields: PaymentMethodConfigField[];
  userInputFields?: PaymentMethodConfigField[];

  initiatePayment: (
    orderId: string,
    amount: number,
    currency: string,
    configData: Record<string, any>,
    userInput?: Record<string, any>,
    userId?: string,
  ) => Promise<{
    success: boolean;
    paymentId?: string;
    transactionId?: string;
    redirectUrl?: string;
    nextStep?: PaymentStatus;
    message?: string; // Arabic message
    data?: Record<string, any>;
  }>;

  verifyPayment?: (
    paymentId: string,
    verificationData: Record<string, any>,
    configData: Record<string, any>,
  ) => Promise<{
    success: boolean;
    status: PaymentStatus;
    message?: string; // Arabic message
    transactionId?: string; // Gateway reference
  }>;

  handleWebhook?: (
    payload: Record<string, any>,
    headers: Record<string, string>,
    configData: Record<string, any>,
  ) => Promise<{
    success: boolean;
    orderId?: string;
    paymentId?: string;
    transactionId?: string; // Added this line
    status?: PaymentStatus;
    message?: string; // Arabic message
  }>;
}

export interface BasePaymentData {
  initiatedAt: string;
  [key: string]: any;
}

export interface BinancePayPaymentData extends BasePaymentData {
  prepayId?: string;
}

export interface ManualPaymentData extends BasePaymentData {
  adminNotes?: string;
}

export interface PaymentMethodConfiguration {
  id: string; // UUID
  methodCode: PaymentMethodCode;
  displayName: string; // Arabic name
  description?: string | null; // Arabic description - updated to allow null
  configData: Record<string, any>; // Stores API keys, specific settings
  isEnabled: boolean;
  sortOrder?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
