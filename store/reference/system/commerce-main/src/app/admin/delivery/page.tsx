'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { BadgeCheck, BadgeAlert, Settings, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { DeliveryMethodCode, DeliveryMethodConfiguration } from '@/modules/delivery/types/deliveryTypes';

// Static definitions for supported delivery methods
const methodDefinitions: Record<DeliveryMethodCode, { displayName: string; description: string; icon: string }> = {
  [DeliveryMethodCode.VANEX]: {
    displayName: 'ڤانيكس',
    description: 'توصيل عبر خدمة ڤانيكس',
    icon: '/vanex.svg',
  },
  [DeliveryMethodCode.NAWRES]: {
    displayName: 'نوارس',
    description: 'توصيل عبر خدمة نوارس',
    icon: '/nawres.svg',
  },
  [DeliveryMethodCode.DARB_SABEEL]: {
    displayName: 'درب السبيل',
    description: 'توصيل عبر درب السبيل',
    icon: '/sabil.svg',
  }
};

const SUPPORTED_DELIVERY_METHODS = Object.entries(methodDefinitions).map(
  ([methodCode, { displayName, description, icon }]) => ({
    methodCode: methodCode as DeliveryMethodCode,
    displayName,
    description,
    icon,
  })
);

export default function DeliveryMethodsPage() {
  const queryClient = useQueryClient();
  const [pendingToggle, setPendingToggle] = React.useState<string | null>(null);

  // Fetch existing configs
  const { data: configs, isLoading } = useQuery<DeliveryMethodConfiguration[]>({
    queryKey: ['admin-delivery-methods'],
    queryFn: async () => {
      const res = await fetch('/api/delivery');
      if (!res.ok) throw new Error('فشل في جلب طرق التوصيل');
      const json = await res.json();
      return json.data as DeliveryMethodConfiguration[];
    },
  });

  // Merge static methods with DB configs
  const methods = SUPPORTED_DELIVERY_METHODS.map((method) => {
    const config = configs?.find((c) => c.code === method.methodCode);
    return {
      ...method,
      id: config?.id,
      name: config?.name || method.displayName,
      isActive: config?.isActive ?? false,
    };
  });

  // Mutation for toggling activation
  const toggleActivation = useMutation({
    mutationFn: async ({ id, methodCode, isActive }: { id?: string; methodCode: DeliveryMethodCode; isActive: boolean }) => {
      setPendingToggle(id || methodCode);
      if (id) {
        const res = await fetch(`/api/delivery/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'فشل في تحديث حالة التوصيل');
        }
        return res.json();
      } else {
        const res = await fetch('/api/delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: methodCode, name: methodDefinitions[methodCode].displayName, configuration: {}, isActive }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'فشل في إنشاء طريقة التوصيل');
        }
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-methods'] });
      toast.success('تم تحديث إعدادات التوصيل');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    },
    onSettled: () => setPendingToggle(null),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="container p-6 mx-auto" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">إدارة طرق التوصيل</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {methods.map((method) => (
          <Card key={method.methodCode}>
            <CardHeader>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <img src={method.icon} alt={`${method.name} icon`} className="h-7 w-7 object-contain" />
                  <CardTitle className="text-xl">{method.name}</CardTitle>
                </div>
                {method.isActive ? (
                  <BadgeCheck className="text-green-500 h-6 w-6" />
                ) : (
                  <BadgeAlert className="text-amber-500 h-6 w-6" />
                )}
              </div>
              <CardDescription>{method.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`toggle-${method.methodCode}`}>مفعل</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`toggle-${method.methodCode}`}
                      checked={method.isActive}
                      disabled={pendingToggle === (method.id || method.methodCode)}
                      onCheckedChange={(checked) =>
                        toggleActivation.mutate({ id: method.id, methodCode: method.methodCode, isActive: checked })
                      }
                    />
                    {pendingToggle === (method.id || method.methodCode) && (
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                    )}
                  </div>
                </div>
                <Link href={`/admin/delivery/${method.methodCode}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                  <Settings className="w-5 h-5" />
                  <span>إعدادات</span>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
