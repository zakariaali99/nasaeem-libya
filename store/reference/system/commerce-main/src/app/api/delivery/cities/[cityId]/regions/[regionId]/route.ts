import { NextRequest } from 'next/server';
import * as deliveryController from '@/modules/delivery/controller/deliveryController';

export async function GET(req: NextRequest, { params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;
  return deliveryController.getRegion(req, { params: { regionId } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;
  return deliveryController.updateRegion(req, { params: { regionId } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;
  return deliveryController.deleteRegion(req, { params: { regionId } });
}