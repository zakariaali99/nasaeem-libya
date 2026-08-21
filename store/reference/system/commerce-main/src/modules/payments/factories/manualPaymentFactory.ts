import { PaymentMethod, PaymentMethodCode, PaymentStatus } from "@/modules/payments/types/paymentTypes";

/**
 * Factory function to create Manual Payment method instance
 * @param configData Configuration data for Manual Payment
 */
export function createManualPaymentMethod(configData: Record<string, any>): PaymentMethod {
  return {
    code: PaymentMethodCode.MANUAL_PAYMENT,
    name: "الدفع اليدوي",
    description: "تحويل بنكي أو دفع نقدي",
    isEnabled: true,
    configurationFields: [
      { name: "instructionsAr", label: "تعليمات الدفع (العربية)", type: "text", required: true },
      { name: "instructionsEn", label: "تعليمات الدفع (الإنجليزية)", type: "text", required: false },
    ],
    userInputFields: [
      { name: "transferReceipt", label: "إيصال التحويل (اختياري)", type: "text", required: false },
      { name: "transferDate", label: "تاريخ التحويل", type: "text", required: true },
      { name: "transferNote", label: "ملاحظات إضافية", type: "text", required: false },
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
        console.log(`Initiating Manual Payment for order: ${orderId}`);
        // For manual payments, we just record the intent to pay and any user provided details

        const paymentId = `MANUAL_${Date.now()}_${orderId}`;

        // Store user input data if provided
        const paymentData = {
          transferReceipt: userInput?.transferReceipt || null,
          transferDate: userInput?.transferDate || new Date().toISOString(),
          transferNote: userInput?.transferNote || "",
          amount,
          currency,
          timestamp: new Date().toISOString(),
        };

        return {
          success: true,
          paymentId,
          transactionId: `TX_MANUAL_${Date.now()}`,
          nextStep: PaymentStatus.PENDING,
          message: "تم تسجيل طلب الدفع اليدوي بنجاح. سيتم مراجعة الدفع من قبل فريق الإدارة.",
          data: paymentData
        };
      } catch (error: any) {
        console.error("Error initiating Manual Payment:", error);
        return {
          success: false,
          message: "فشل في تسجيل طلب الدفع. يرجى المحاولة مرة أخرى.",
        };
      }
    },

    // Verify the payment - this would be an admin action for manual payments
    verifyPayment: async (
      paymentId: string,
      verificationData: Record<string, any>,
      configData: Record<string, any>,
    ) => {
      try {
        console.log(`Verifying Manual Payment: ${paymentId}`);
        // In a real implementation, an admin would verify the payment in the dashboard

        // Extract verification data (admin review result)
        const { adminVerified, adminNotes } = verificationData;

        if (adminVerified === undefined) {
          // This is a standard frontend checkout complete check, keep it PENDING
          return {
            success: true,
            status: PaymentStatus.PENDING,
            message: "الدفع قيد المراجعة"
          };
        } else if (adminVerified) {
          return {
            success: true,
            status: PaymentStatus.COMPLETED,
            message: "تم التحقق من الدفع وتأكيده"
          };
        } else {
          return {
            success: false,
            status: PaymentStatus.FAILED,
            message: "تم رفض الدفع: " + (adminNotes || "لم يتم تقديم سبب")
          };
        }
      } catch (error: any) {
        console.error("Error verifying Manual Payment:", error);
        return {
          success: false,
          status: PaymentStatus.FAILED,
          message: "فشل في التحقق من الدفع"
        };
      }
    },
  };
}
