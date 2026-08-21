import { NextRequest, NextResponse } from "next/server";
import { PaymentsController } from "@/modules/payments/controllers/paymentsController";

// Handle GET requests for a specific payment method by methodCode
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ methodCode: string }> }
) {
  const { methodCode } = await params;
  
  if (!methodCode) {
    return NextResponse.json(
      { error: "رمز طريقة الدفع مطلوب" },
      { status: 400 }
    );
  }

  return PaymentsController.getPaymentMethod(request, methodCode);
}

// Handle PUT requests to update a payment method configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ methodCode: string }> }
) {
  const {methodCode} = await params;
  
  if (!methodCode) {
    return NextResponse.json(
      { error: "رمز طريقة الدفع مطلوب" },
      { status: 400 }
    );
  }

  return PaymentsController.updatePaymentMethod(request, methodCode);
}

// Handle DELETE requests to remove a payment method configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ methodCode: string }> }
) {
  const { methodCode } = await params;
  if (!methodCode) {
    return NextResponse.json(
      { error: "رمز طريقة الدفع مطلوب" },
      { status: 400 }
    );
  }

  return PaymentsController.deletePaymentMethod(request, methodCode);
}