'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderStatus } from '@/modules/orders/types/orderTypes';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OrderStatusManagerProps {
    orderId: string;
    currentStatus: OrderStatus;
}

export function OrderStatusManager({ orderId, currentStatus }: OrderStatusManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<OrderStatus>(currentStatus);
    const router = useRouter();

    const statusMap = {
        [OrderStatus.Pending]: 'قيد الانتظار',
        [OrderStatus.Processing]: 'جاري المعالجة',
        [OrderStatus.Shipped]: 'تم الشحن',
        [OrderStatus.Delivered]: 'تم التسليم',
        [OrderStatus.Cancelled]: 'ملغي',
    };

    const handleUpdateStatus = async () => {
        if (status === currentStatus) {
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status }),
            });

            if (!response.ok) {
                throw new Error('فشل تحديث الحالة');
            }

            toast.success('تم تحديث حالة الطلب بنجاح');
            setIsOpen(false);
            router.refresh();
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('حدث خطأ أثناء تحديث الحالة');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">تغيير الحالة</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تغيير حالة الطلب</DialogTitle>
                    <DialogDescription>
                        اختر الحالة الجديدة للطلب. سيتم تحديث الحالة فوراً.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Select
                        value={status}
                        onValueChange={(value) => setStatus(value as OrderStatus)}
                        dir="rtl"
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="اختر الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.values(OrderStatus).map((s) => (
                                <SelectItem key={s} value={s}>
                                    {statusMap[s]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
                        إلغاء
                    </Button>
                    <Button onClick={handleUpdateStatus} disabled={isLoading}>
                        {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        تأكيد التغيير
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
