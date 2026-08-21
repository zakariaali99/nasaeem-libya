import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/api-protection';
import { ROLES } from '@/lib/rbac';
import * as discountService from '../services/discountService';

export async function getDiscounts(req: NextRequest) {
  const discounts = await discountService.listDiscounts();
  return NextResponse.json({ data: discounts });
}

export async function getDiscountById(req: NextRequest, { params }: { params: { id: string } }) {
  const discount = await discountService.getDiscountById(params.id);
  if (!discount) {
    return NextResponse.json({ message: 'العرض غير موجود' }, { status: 404 });
  }
  return NextResponse.json({ data: discount });
}

export async function createDiscount(req: NextRequest) {
  const authResult = await validateRequest(req, [ROLES.ADMIN, ROLES.MANAGER]);
  if (!authResult.success) {
    return authResult.response;
  }
  const body = await req.json();
  const discount = await discountService.createDiscount(body);
  return NextResponse.json({ data: discount });
}

export async function updateDiscount(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await validateRequest(req, [ROLES.ADMIN, ROLES.MANAGER]);
  if (!authResult.success) {
    return authResult.response;
  }
  const body = await req.json();
  const discount = await discountService.updateDiscount(params.id, body);
  if (!discount) {
    return NextResponse.json({ message: 'العرض غير موجود' }, { status: 404 });
  }
  return NextResponse.json({ data: discount });
}

export async function deleteDiscount(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await validateRequest(req, [ROLES.ADMIN, ROLES.MANAGER]);
  if (!authResult.success) {
    return authResult.response;
  }
  const deleted = await discountService.deleteDiscount(params.id);
  if (!deleted) {
    return NextResponse.json({ message: 'العرض غير موجود' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
