import { NextRequest, NextResponse } from "next/server";
import { PaymentsController } from "@/modules/payments/controllers/paymentsController";

// This route handles listing all payment methods
export async function GET(request: NextRequest) {
  // Check for admin requests - has admin query param
  const url = new URL(request.url);
  const isAdmin = url.searchParams.get("admin") === "true";

  if (isAdmin) {
    return PaymentsController.getAdminPaymentMethods(request);
  }

  // Public endpoint - only returns enabled methods with non-sensitive data
  return PaymentsController.getPublicPaymentMethods();
}