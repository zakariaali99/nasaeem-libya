import { NextRequest } from 'next/server';
import * as deliveryController from '@/modules/delivery/controller/deliveryController';

export async function GET(req: NextRequest) {
  return deliveryController.getRegions(req);
}

export async function POST(req: NextRequest) {
  return deliveryController.createRegion(req);
}