"use client";

import React from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Info,
  Sparkles,
  Bell,
  Gift,
  Star,
  Tag,
  X,
} from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';
import { AnnouncementBarWidget, WidgetType, announcementIconValues, AnnouncementIcon } from '@/modules/customization/types/customizationTypes';
import { useAppSession } from '@/components/providers/SessionProvider';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const iconOptions: { value: AnnouncementIcon; label: string; Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }[] = [
  { value: 'megaphone', label: 'مكبر صوت', Icon: Megaphone },
  { value: 'info', label: 'معلومات', Icon: Info },
  { value: 'sparkles', label: 'بريق', Icon: Sparkles },
  { value: 'bell', label: 'جرس', Icon: Bell },
  { value: 'gift', label: 'هدية', Icon: Gift },
  { value: 'star', label: 'نجمة', Icon: Star },
  { value: 'tag', label: 'عرض', Icon: Tag },
];

export const AnnouncementBarFields: React.FC<WidgetFieldProps> = ({ control, namePrefix }) => (
  <div className="space-y-3">
    <Controller
      name={`${namePrefix}.title`}
      control={control}
      render={({ field }) => <Input {...field} placeholder="عنوان الشريط (مثال: تنبيه)" />}
    />
    <Controller
      name={`${namePrefix}.message`}
      control={control}
      render={({ field }) => <Input {...field} placeholder="نص الإعلان" />}
    />
    <Controller
      name={`${namePrefix}.linkLabel`}
      control={control}
      render={({ field }) => <Input {...field} placeholder="نص الرابط (اختياري)" />}
    />
    <Controller
      name={`${namePrefix}.linkUrl`}
      control={control}
      render={({ field }) => <Input {...field} placeholder="رابط الإعلان (اختياري)" />}
    />
    <Controller
      name={`${namePrefix}.dismissible`}
      control={control}
      render={({ field }) => (
        <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm font-medium">إظهار زر إغلاق</span>
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </div>
      )}
    />
    <Controller
      name={`${namePrefix}.icon`}
      control={control}
      render={({ field }) => {
        const current = iconOptions.find((i) => i.value === field.value) || iconOptions[0];
        return (
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <current.Icon className="h-4 w-4" aria-hidden />
                  <span>أيقونة الشريط</span>
                </span>
                <span className="text-xs text-muted-foreground">{current.label}</span>
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>اختر الأيقونة</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3">
                {iconOptions.map(({ value, label, Icon }) => {
                  const active = field.value ? field.value === value : value === 'megaphone';
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                      className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-sm transition ${active ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'}`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border bg-white text-amber-700">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => field.onChange(field.value || 'megaphone')}>
                  حفظ الاختيار
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      }}
    />
  </div>
);

export const AnnouncementBarPreviewRenderer: WidgetPreviewRenderer<AnnouncementBarWidget> = ({ widget }) => {
  const { message, linkLabel, linkUrl, dismissible, icon, title } = widget.data;
  const { session } = useAppSession();
  const isAdmin = session?.user?.role === 'admin';
  const storageKey = React.useMemo(() => `announcement-dismissed-${widget.id}`, [widget.id]);
  const [dismissed, setDismissed] = React.useState(false);

  const iconMap: Record<AnnouncementIcon, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
    megaphone: Megaphone,
    info: Info,
    sparkles: Sparkles,
    bell: Bell,
    gift: Gift,
    star: Star,
    tag: Tag,
  };
  const IconCmp = icon ? iconMap[icon as AnnouncementIcon] || Megaphone : Megaphone;

  React.useEffect(() => {
    if (isAdmin) return;
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === '1') setDismissed(true);
  }, [storageKey, isAdmin]);

  const handleClose = () => {
    setDismissed(true);
    if (isAdmin) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, '1');
  };

  if (dismissed) return null;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-orange-50 px-4 py-3 text-amber-900 shadow-sm" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-white/70 text-amber-700 shadow-inner">
            <IconCmp className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-0.5">
            <div className="text-sm font-bold">{title || 'تنبيه'}</div>
            <div className="text-sm leading-6">{message}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {linkLabel && (
            <Link
              href={linkUrl || '#'}
              className="text-sm font-semibold text-amber-800 underline decoration-amber-500 decoration-2 underline-offset-4 hover:text-amber-900"
            >
              {linkLabel}
            </Link>
          )}
          {dismissible && (
            <button
              type="button"
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-white/70 text-amber-700 transition hover:bg-white"
              aria-label="إغلاق الإعلان"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const announcementBarDefinition = {
  type: WidgetType.ANNOUNCEMENT_BAR,
  Fields: AnnouncementBarFields,
  Preview: AnnouncementBarPreviewRenderer,
};
