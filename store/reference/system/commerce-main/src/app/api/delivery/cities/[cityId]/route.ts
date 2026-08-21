import { NextRequest } from 'next/server';
import * as deliveryController from '@/modules/delivery/controller/deliveryController';

export async function GET(req: NextRequest, { params }: { params: Promise<{ cityId: string }> }) {
  const { cityId } = await params;
  return deliveryController.getCity(req, { params: { cityId } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ cityId: string }> }) {
  const { cityId } = await params;
  return deliveryController.updateCity(req, { params: { cityId } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ cityId: string }> }) {
  const { cityId } = await params;
  return deliveryController.deleteCity(req, { params: { cityId } });
}