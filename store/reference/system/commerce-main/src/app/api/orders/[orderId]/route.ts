import { NextRequest, NextResponse } from 'next/server';
import { getOrder, updateOrder } from '@/modules/orders/controllers/orderController';

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { orderId } = await params;
  return getOrder(req, { params: { orderId } });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { orderId } = await params;
  return updateOrder(req, { params: { orderId } });
}
