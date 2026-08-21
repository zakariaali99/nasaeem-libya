import { NextRequest } from 'next/server';
import * as deliveryController from '@/modules/delivery/controller/deliveryController';

export async function GET(req: NextRequest, { params }: { params: Promise<{ methodCode: string }> }) {
  // methodCode corresponds to configId
  const { methodCode } = await params;
  return deliveryController.getDeliveryMethodConfig(req, { params: { configId: methodCode } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ methodCode: string }> }) {
  const { methodCode } = await params;
  return deliveryController.updateDeliveryMethodConfig(req, { params: { configId: methodCode } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ methodCode: string }> }) {
  const { methodCode } = await params;
  return deliveryController.deleteDeliveryMethodConfig(req, { params: { configId: methodCode } });
}