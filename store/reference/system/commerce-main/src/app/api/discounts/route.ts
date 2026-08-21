import { NextRequest } from 'next/server';
import {
  getDiscounts,
  createDiscount,
} from '@/modules/discounts/controllers/discountController';

export async function GET(req: NextRequest) {
  return getDiscounts(req);
}

export async function POST(req: NextRequest) {
  return createDiscount(req);
}
