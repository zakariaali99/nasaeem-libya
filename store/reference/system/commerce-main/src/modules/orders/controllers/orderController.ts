import { NextRequest, NextResponse } from 'next/server';
import * as orderService from '@/modules/orders/services/orderService';
import { validateRequest } from '@/lib/api-protection';
import { ROLES, PERMISSIONS } from '@/lib/rbac';
import { PaginationParams } from '../types/orderTypes';

// List orders: user sees own, admin sees all
export async function getOrders(req: NextRequest): Promise<NextResponse> {
  const authResult = await validateRequest(req);
  if (!authResult.success) {
    return authResult.response;
  }
  const session = authResult.session;
  const searchParams = req.nextUrl.searchParams;
  const params: PaginationParams = {
    page: searchParams.has('page') ? parseInt(searchParams.get('page') || '1', 10) : undefined,
    limit: searchParams.has('limit') ? parseInt(searchParams.get('limit') || '10', 10) : undefined,
  };

  try {
    const result = PERMISSIONS.VIEW_ORDERS.includes(session.user.role as any)
      ? await orderService.listAllOrders(params)
      : await orderService.listOrdersForUser(session.user.id as string, params);
    return NextResponse.json({ message: 'تم جلب الطلبات', data: result }, { status: 200 });
  } catch (error) {
    console.error('Error listing orders:', error);
    return NextResponse.json({ message: 'خطأ في جلب الطلبات' }, { status: 500 });
  }
}

// Get single order by ID
export async function getOrder(req: NextRequest, { params }: { params: { orderId: string } }): Promise<NextResponse> {
  const { orderId } = params;
  const authResult = await validateRequest(req);
  if (!authResult.success) {
    return authResult.response;
  }
  const session = authResult.session;
  try {
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ message: 'الطلب غير موجود' }, { status: 404 });
    }
    // Only owner or admin can view
    const isPrivileged = PERMISSIONS.VIEW_ORDERS.includes(session.user.role as any);
    if (!isPrivileged && order.userId !== session.user.id) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 });
    }
    return NextResponse.json({ message: 'تم جلب الطلب', data: order }, { status: 200 });
  } catch (error) {
    console.error(`Error fetching order ${params.orderId}:`, error);
    return NextResponse.json({ message: 'خطأ في جلب الطلب' }, { status: 500 });
  }
}

// Update order status (admin only)
export async function updateOrder(req: NextRequest, { params }: { params: { orderId: string } }): Promise<NextResponse> {
  const { orderId } = params;
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_ORDERS]);
  if (!authResult.success) {
    return authResult.response;
  }
  try {
    const body = await req.json();
    const updated = await orderService.updateOrderStatus(orderId, body);
    if (!updated) {
      return NextResponse.json({ message: 'الطلب غير موجود أو التحديث فشل' }, { status: 404 });
    }
    return NextResponse.json({ message: 'تم تحديث حالة الطلب', data: updated }, { status: 200 });
  } catch (error: any) {
    console.error(`Error updating order ${orderId}:`, error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ message: 'بيانات غير صالحة', errors: error.errors }, { status: 400 });
    }
    return NextResponse.json({ message: 'خطأ في تحديث حالة الطلب' }, { status: 500 });
  }
}
