import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/modules/payments/services/paymentService";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";

const paymentService = new PaymentService();

// Handle webhook callbacks for all payment methods
export async function POST(request: NextRequest, { params }: { params: Promise<{ methodCode: string }> }) {
  try {
    // Verify webhook authenticity (in production, verify headers, signature, etc)
    const payload = await request.json();
    const { methodCode } = await params;

    // Validate methodCode
    if (!Object.values(PaymentMethodCode).includes(methodCode as PaymentMethodCode)) {
      return NextResponse.json(
        { error: "رمز طريقة الدفع غير صالح" },
        { status: 400 }
      );
    }

    // Process the webhook
    // Extract headers for verification
    const headersObj: Record<string,string> = Object.fromEntries(request.headers.entries());
    const result = await paymentService.handleWebhook(
      methodCode as PaymentMethodCode,
      payload,
      headersObj
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error processing payment webhook:", error);
    return NextResponse.json(
      { error: "حدث خطأ في معالجة الإشعار" },
      { status: 500 }
    );
  }
}
