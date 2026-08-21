import { PaymentMethod, PaymentMethodCode, PaymentStatus } from "@/modules/payments/types/paymentTypes";

/**
 * Factory function to create Bank Cards on Delivery Payment method instance
 * @param configData Configuration data for Bank Cards on Delivery Payment
 */
export function createBankCardsOnDeliveryMethod(configData: Record<string, any>): PaymentMethod {
    return {
        code: PaymentMethodCode.BANK_CARDS_ON_DELIVERY,
        name: "بطاقة مصرفية عند الاستلام",
        description: "الدفع بالبطاقة المصرفية المباشرة عند التوصيل (نظام POS)",
        isEnabled: true,
        configurationFields: [
            { name: "instructionsAr", label: "تعليمات الدفع (العربية)", type: "text", required: true },
            { name: "instructionsEn", label: "تعليمات الدفع (الإنجليزية)", type: "text", required: false },
        ],
        userInputFields: [
            { name: "customerNote", label: "ملاحظات الدفع (اختياري)", type: "text", required: false },
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
                console.log(`Initiating Bank Cards on Delivery Payment for order: ${orderId}`);
                // For Bank Cards on Delivery, record the intent to pay upon delivery

                const paymentId = `BANKCARD_${Date.now()}_${orderId}`;

                // Store user input data if provided
                const paymentData = {
                    customerNote: userInput?.customerNote || "",
                    amount,
                    currency,
                    timestamp: new Date().toISOString(),
                };

                return {
                    success: true,
                    paymentId,
                    transactionId: `TX_BANKCARD_${Date.now()}`,
                    nextStep: PaymentStatus.PENDING,
                    message: "تم اختيار الدفع بالبطاقة المصرفية عند الاستلام. سيتم الدفع وقت التسليم.",
                    data: paymentData
                };
            } catch (error: any) {
                console.error("Error initiating Bank Cards on Delivery:", error);
                return {
                    success: false,
                    message: "فشل في تسجيل طلب الدفع بالبطاقة المصرفية. يرجى المحاولة مرة أخرى.",
                };
            }
        },

        // Verify the payment - admin/driver updates this when payment is collected
        verifyPayment: async (
            paymentId: string,
            verificationData: Record<string, any>,
            configData: Record<string, any>,
        ) => {
            try {
                console.log(`Verifying Bank Cards on Delivery Payment: ${paymentId}`);

                // Extract verification data (admin review result)
                const { adminVerified, adminNotes } = verificationData;

                if (adminVerified === undefined) {
                    // This is a standard frontend checkout complete check, keep it PENDING
                    return {
                        success: true,
                        status: PaymentStatus.PENDING,
                        message: "الدفع عند الاستلام قيد الانتظار"
                    };
                } else if (adminVerified) {
                    return {
                        success: true,
                        status: PaymentStatus.COMPLETED,
                        message: "تم التحقق من الدفع وتأكيده عبر نقاط البيع"
                    };
                } else {
                    return {
                        success: false,
                        status: PaymentStatus.FAILED,
                        message: "تم رفض الدفع أو لم يتم السداد: " + (adminNotes || "لم يتم تقديم سبب")
                    };
                }
            } catch (error: any) {
                console.error("Error verifying Bank Cards on Delivery Payment:", error);
                return {
                    success: false,
                    status: PaymentStatus.FAILED,
                    message: "فشل في التحقق من الدفع"
                };
            }
        },
    };
}
