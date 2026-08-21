import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/modules/payments/services/paymentService";
import { auth } from "@/lib/auth";
import { PaymentStatus } from "@/modules/payments/types/paymentTypes";
import { z } from "zod";

const paymentService = new PaymentService();

export async function PUT(
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
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول" },
        { status: 403 }
      );
    }

    // Validate request data
    const updateSchema = z.object({
      status: z.nativeEnum(PaymentStatus, {
        errorMap: () => ({ message: "حالة دفع غير صالحة" }),
      }),
      adminNotes: z.string().optional(),
    });

    const data = await request.json();
    const validatedData = updateSchema.parse(data);

    // Update payment status
    const result = await paymentService.updatePaymentStatusByAdmin(
      paymentId,
      validatedData.status,
      validatedData.adminNotes,
      session.user.id
    );

    return NextResponse.json({ success: result, message: "تم تحديث حالة الدفع بنجاح" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: error.format() },
        { status: 400 }
      );
    }

    console.error("Error updating payment status:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء تحديث حالة الدفع" },
      { status: 500 }
    );
  }
}
