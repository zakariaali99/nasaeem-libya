import { NextRequest, NextResponse } from "next/server";
import { handleWebhook } from "@/modules/delivery/services/deliveryService";
import { DeliveryMethodCode } from "@/modules/delivery/types/deliveryTypes";

// Handle webhook callbacks for all delivery methods
export async function POST(request: NextRequest, { params }: { params: Promise<{ methodCode: string }> }) {
  try {
    const rawBody = await request.text();
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const { methodCode } = await params;

    // Validate methodCode
    if (!Object.values(DeliveryMethodCode).includes(methodCode as DeliveryMethodCode)) {
      return NextResponse.json(
        { error: "رمز طريقة التوصيل غير صالح" },
        { status: 400 }
      );
    }

    // Process the webhook
    // Extract headers for verification
    const headersObj: Record<string, string> = Object.fromEntries(request.headers.entries());
    const result = await handleWebhook(
      methodCode as DeliveryMethodCode,
      payload,
      headersObj,
      rawBody
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error processing delivery webhook:", error);
    return NextResponse.json(
      { error: "حدث خطأ في معالجة إشعار التوصيل" },
      { status: 500 }
    );
  }
}
