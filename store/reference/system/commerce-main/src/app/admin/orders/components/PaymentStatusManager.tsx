'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaymentStatus } from '@/modules/payments/types/paymentTypes';
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

interface PaymentStatusManagerProps {
    orderId: string;
    currentStatus: PaymentStatus | string;
}

export function PaymentStatusManager({ orderId, currentStatus }: PaymentStatusManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<string>(currentStatus);
    const router = useRouter();

    const statusMap: Record<string, string> = {
        [PaymentStatus.PENDING]: 'معلق',
        [PaymentStatus.COMPLETED]: 'مكتمل',
        [PaymentStatus.FAILED]: 'فاشل',
        [PaymentStatus.CANCELLED]: 'ملغي',
        [PaymentStatus.REFUNDED]: 'تم استرداد',
        [PaymentStatus.WAITING_FOR_VERIFICATION]: 'في انتظار التحقق',
        'unpaid': 'غير مدفوع',
        'paid': 'مدفوع'
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
                body: JSON.stringify({ paymentStatus: status }),
            });

            if (!response.ok) {
                throw new Error('فشل تحديث الحالة');
            }

            toast.success('تم تحديث حالة الدفع بنجاح');
            setIsOpen(false);
            router.refresh();
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('حدث خطأ أثناء تحديث حالة الدفع');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (open) setStatus(currentStatus);
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 rounded-full">
                    <Edit2 className="h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تغيير حالة الدفع</DialogTitle>
                    <DialogDescription>
                        اختر الحالة الجديدة للدفع. سيتم تحديث الحالة فوراً.
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
                            {Object.values(PaymentStatus).map((s) => (
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
