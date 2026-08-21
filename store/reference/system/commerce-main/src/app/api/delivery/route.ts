import { NextRequest, NextResponse } from 'next/server';
import * as deliveryController from '@/modules/delivery/controller/deliveryController';

export async function GET(req: NextRequest) {
  return deliveryController.listDeliveryMethodConfigs(req);
}

export async function POST(req: NextRequest) {
  return deliveryController.createDeliveryMethodConfig(req);
}