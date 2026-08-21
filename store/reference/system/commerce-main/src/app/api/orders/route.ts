import { getOrders } from '@/modules/orders/controllers/orderController';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return getOrders(req);
}
