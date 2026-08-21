import React from 'react';
import Link from 'next/link';
import { listAllOrders } from '@/modules/orders/services/orderService';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from '@/components/ui/pagination';
import { Order, OrderStatus } from '@/modules/orders/types/orderTypes';
import { Badge } from '@/components/ui/badge';
import { Eye, ArrowRight } from 'lucide-react';

export default async function Page({ searchParams }: { searchParams?: Promise<{ page?: string; limit?: string }> }) {
  // Mapping of order statuses to Arabic labels and badge variants
  const statusMap = {
    [OrderStatus.Pending]: { label: 'قيد الانتظار', variant: 'secondary' },
    [OrderStatus.Processing]: { label: 'جاري المعالجة', variant: 'default' },
    [OrderStatus.Shipped]: { label: 'تم الشحن', variant: 'secondary' },
    [OrderStatus.Delivered]: { label: 'تم التسليم', variant: 'default' },
    [OrderStatus.Cancelled]: { label: 'ملغي', variant: 'destructive' },
  } as const;

  const params = searchParams ? await searchParams : {};
  const page = params.page ? parseInt(params.page, 10) : 1;
  const limit = params.limit ? parseInt(params.limit, 10) : 10;
  const result = await listAllOrders({ page, limit });
  const { data, totalPages } = result;

  return (
    <div dir="rtl" className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">قائمة الطلبات</h1>
          <p className="text-muted-foreground mt-1">إدارة الطلبات ومتابعة التوصيل</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>جميع الطلبات</CardTitle>
          <CardDescription>عرض تفاصيل الطلبات وحالاتها الحالية</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">رقم الطلب</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>رقم التتبع</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((order) => (
                <TableRow key={order.id} className="group">
                  <TableCell className="font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/users/${order.userId}`} className="hover:underline text-primary">
                      {order.userName ?? order.userId}
                    </Link>
                  </TableCell>
                  <TableCell>{parseFloat(order.total).toFixed(2)} د.ل</TableCell>
                  <TableCell>
                    <Badge variant={statusMap[order.status]?.variant as any} className="whitespace-nowrap">
                      {statusMap[order.status]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.trackingUrl ? (
                      <Link href={order.trackingUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1 text-sm">
                        {order.trackingNumber}
                        <ArrowRight className="h-3 w-3 -rotate-45" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">{order.trackingNumber ?? '-'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(order.createdAt).toLocaleDateString('ar-LY')}
                  </TableCell>
                  <TableCell className="text-left">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/orders/${order.id}`}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">عرض التفاصيل</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <div className="p-4 border-t">
            <Pagination>
              <PaginationPrevious
                href={`/admin/orders?page=${Math.max(1, page - 1)}&limit=${limit}`}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              />
              <PaginationContent>
                {Array.from({ length: totalPages }, (_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href={`/admin/orders?page=${i + 1}&limit=${limit}`}
                      isActive={i + 1 === page}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              </PaginationContent>
              <PaginationNext
                href={`/admin/orders?page=${Math.min(totalPages, page + 1)}&limit=${limit}`}
                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </Pagination>
          </div>
        )}
      </Card>
    </div>
  );
}
