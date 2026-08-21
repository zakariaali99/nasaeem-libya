import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/modules/payments/services/paymentService";
import { auth } from "@/lib/auth";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";
import { z } from "zod";

const paymentService = new PaymentService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    
    if (!paymentId) {
      return NextResponse.json(
        { error: "معرف الدفع مطلوب" },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession(request);
    if (!session?.user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول للتحقق من الدفع" },
        { status: 401 }
      );
    }

    // Validate request data
    const verificationSchema = z.object({
      methodCode: z.nativeEnum(PaymentMethodCode, {
        errorMap: () => ({ message: "رمز طريقة دفع غير صالح" }),
      }),
      verificationData: z.record(z.any()),
      verificationId: z.string().optional(), // For tracking purposes
    });

    const data = await request.json();
    const validatedData = verificationSchema.parse(data);
    
    console.log(`Payment verification request for ${paymentId}`, {
      methodCode: validatedData.methodCode,
      verificationId: validatedData.verificationId,
      userId: session.user.id
    });

    // Verify the payment
    const result = await paymentService.verifyPayment(
      paymentId,
      validatedData.methodCode,
      validatedData.verificationData
    );
    
    console.log(`Payment verification result for ${paymentId}`, {
      success: result.success,
      status: result.status,
      verificationId: validatedData.verificationId,
      alreadyVerified: result.alreadyVerified
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: error.format() },
        { status: 400 }
      );
    }

    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء التحقق من الدفع" },
      { status: 500 }
    );
  }
}
