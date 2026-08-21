import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/modules/payments/services/paymentService";
import { auth } from "@/lib/auth";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";
import { z } from "zod";
import { PaymentsController } from "@/modules/payments/controllers/paymentsController";

const paymentService = new PaymentService();

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession(request);
    if (!session?.user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول لإجراء الدفع" },
        { status: 401 }
      );
    }

    // Parse and normalize request data
    const raw = await request.json();
    // If orderId is nested object, extract actual string
    const normalizedOrderId =
      raw.orderId && typeof raw.orderId === "object" && raw.orderId.orderId
        ? raw.orderId.orderId
        : raw.orderId;
    const paymentSchema = z.object({
      orderId: z.string(),
      methodCode: z.nativeEnum(PaymentMethodCode, {
        errorMap: () => ({ message: "رمز طريقة دفع غير صالح" }),
      }),
      amount: z.number().positive("يجب أن يكون المبلغ أكبر من صفر"),
      currency: z.string().default("LYD"),
      userInput: z.record(z.any()).optional(),
    });
    const validatedData = paymentSchema.parse({
      ...raw,
      orderId: normalizedOrderId,
    });
    console.log('validated payment data:', validatedData);

    // Initiate payment
    const result = await paymentService.initiatePayment(
      validatedData.orderId,
      validatedData.amount,
      validatedData.currency,
      validatedData.methodCode,
      validatedData.userInput,
      session.user.id
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: error.format() },
        { status: 400 }
      );
    }

    console.error("Error initiating payment:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء بدء عملية الدفع" },
      { status: 500 }
    );
  }
}

// Admin: List payments with pagination, search, filtering, sorting
export async function GET(request: NextRequest) {
  return PaymentsController.listPayments(request);
}
