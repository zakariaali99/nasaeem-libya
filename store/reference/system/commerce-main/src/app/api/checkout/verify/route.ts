import { NextRequest, NextResponse } from 'next/server';
import { CheckoutController } from '@/modules/orders/controllers/checkoutController';

export async function POST(req: NextRequest) {
  return CheckoutController.verifyPayment(req);
}
