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
import { Loader2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShippingStatusManagerProps {
    orderId: string;
    currentStatus: OrderStatus | string;
}

export function ShippingStatusManager({ orderId, currentStatus }: ShippingStatusManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<string>(currentStatus || OrderStatus.Pending);
    const router = useRouter();

    const statusMap: Record<string, string> = {
        [OrderStatus.Pending]: 'قيد الانتظار',
        [OrderStatus.Processing]: 'جاري التجهيز',
        [OrderStatus.Shipped]: 'قيد التوصيل (تم الشحن)',
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
                body: JSON.stringify({ shippingStatus: status }),
            });

            if (!response.ok) {
                throw new Error('فشل تحديث الحالة');
            }

            toast.success('تم تحديث حالة التوصيل بنجاح');
            setIsOpen(false);
            router.refresh();
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('حدث خطأ أثناء تحديث حالة التوصيل');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (open) setStatus(currentStatus || OrderStatus.Pending);
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 rounded-full">
                    <Edit2 className="h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تغيير حالة التوصيل</DialogTitle>
                    <DialogDescription>
                        اختر الحالة الجديدة للتوصيل (الشحن). سيتم تحديث الحالة فوراً.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Select
                        value={status}
                        onValueChange={setStatus}
                        dir="rtl"
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="اختر الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.values(OrderStatus).map((s) => (
                                <SelectItem key={s} value={s}>
                                    {statusMap[s] || s}
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
