"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { LayoutDashboard, Calendar, FileEdit, Files, Trash2, Edit, Star, StarOff, Clock } from "lucide-react";
import Link from 'next/link';
import { toast } from 'sonner';

interface Layout {
    id: string;
    name: string;
    isGlobalActive: boolean;
    activeStartDate: string | null;
    activeEndDate: string | null;
    activeDays: number[] | null;
    activeStartHour: number | null;
    activeEndHour: number | null;
    createdAt: string;
    updatedAt: string;
}

export default function LayoutsDashboardPage() {
    return <LayoutsDashboard />
}

function LayoutsDashboard() {
    const queryClient = useQueryClient();
    
    // Fetch Layouts
    const { data, isLoading, error } = useQuery<{ data: Layout[] }>({
        queryKey: ['storefront-layouts'],
        queryFn: async () => {
            const res = await fetch('/api/admin/storefront-layouts');
            if (!res.ok) throw new Error("فشل تحميل التخطيطات");
            return res.json();
        }
    });

    const layouts = data?.data || [];

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (payload: { name: string }) => {
            const res = await fetch('/api/admin/storefront-layouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("فشل إنشاء التخطيط");
            return res.json();
        },
        onSuccess: () => {
            toast.success("تم إنشاء المسودة بنجاح");
            queryClient.invalidateQueries({ queryKey: ['storefront-layouts'] });
            setCreateName("");
        },
        onError: (err: any) => toast.error(err.message)
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
            const res = await fetch(`/api/admin/storefront-layouts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("فشل التحديث");
            return res.json();
        },
        onSuccess: () => {
            toast.success("تم تحديث التخطيط");
            queryClient.invalidateQueries({ queryKey: ['storefront-layouts'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/storefront-layouts/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("لا يمكن حذف التخطيط الأساسي");
            return res.json();
        },
        onSuccess: () => {
            toast.success("تم حذف التخطيط");
            queryClient.invalidateQueries({ queryKey: ['storefront-layouts'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const duplicateMutation = useMutation({
        mutationFn: async ({ id, newName }: { id: string, newName: string }) => {
            const res = await fetch(`/api/admin/storefront-layouts/${id}/duplicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            if (!res.ok) throw new Error("فشل نسخ التخطيط");
            return res.json();
        },
        onSuccess: () => {
            toast.success("تم النسخ بنجاح");
            queryClient.invalidateQueries({ queryKey: ['storefront-layouts'] });
            setDuplicateName("");
            setDuplicateTargetId(null);
        },
        onError: (err: any) => toast.error(err.message)
    });

    const [createName, setCreateName] = useState("");
    const [duplicateName, setDuplicateName] = useState("");
    const [duplicateTargetId, setDuplicateTargetId] = useState<string | null>(null);

    if (isLoading) return <div dir="rtl" className="p-8">جاري التحميل...</div>;
    if (error) return <div dir="rtl" className="p-8 text-red-500">حدث خطأ</div>;

    const globalActive = layouts.find(l => l.isGlobalActive);
    
    // Libya timezone checks for the frontend
    const now = new Date();
    const libyaOffset = 2 * 60; // minutes
    const libyaTime = new Date(now.getTime() + (libyaOffset + now.getTimezoneOffset()) * 60000);
    const currentDay = libyaTime.getDay();
    const currentHour = libyaTime.getHours();

    const isLayoutScheduled = (l: Layout) => {
        return (l.activeStartDate && l.activeEndDate) || (l.activeDays && l.activeDays.length > 0) || (l.activeStartHour !== null && l.activeEndHour !== null);
    };

    const isLayoutActiveNow = (l: Layout) => {
        if (l.isGlobalActive) return true;
        if (!isLayoutScheduled(l)) return false;

        let active = true;
        if (l.activeStartDate && l.activeEndDate) {
            if (now < new Date(l.activeStartDate) || now > new Date(l.activeEndDate)) active = false;
        }
        if (active && l.activeDays && l.activeDays.length > 0) {
            if (!l.activeDays.includes(currentDay)) active = false;
        }
        if (active && l.activeStartHour !== null && l.activeEndHour !== null) {
            const s = l.activeStartHour;
            const e = l.activeEndHour;
            if (s <= e) {
                if (currentHour < s || currentHour >= e) active = false;
            } else {
                if (currentHour < s && currentHour >= e) active = false;
            }
        }
        return active;
    };

    const scheduled = layouts.filter(l => !l.isGlobalActive && isLayoutScheduled(l));
    const drafts = layouts.filter(l => !l.isGlobalActive && !isLayoutScheduled(l));
    const activeScheduled = scheduled.filter(l => isLayoutActiveNow(l));

    return (
        <div dir="rtl" className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2"><LayoutDashboard className="w-8 h-8 text-primary" /> التخطيطات وتصميم الواجهة</h1>
                    <p className="text-gray-500 mt-1">إدارة المسودات، والتخطيطات المجدولة، والتخطيط الافتراضي للمتجر الخاص بك.</p>
                </div>
                
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="shrink-0"><FileEdit className="ml-2 w-4 h-4" /> إنشاء مسودة جديدة</Button>
                    </DialogTrigger>
                    <DialogContent dir="rtl">
                        <DialogHeader>
                            <DialogTitle>إنشاء مسودة تخطيط جديدة</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <Label>اسم المسودة</Label>
                            <Input placeholder="مثال: الواجهة الرمضانية..." value={createName} onChange={(e) => setCreateName(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">إلغاء</Button>
                            </DialogClose>
                            <DialogClose asChild>
                                <Button 
                                    onClick={() => { if (createName) createMutation.mutate({ name: createName }); }}
                                    disabled={!createName || createMutation.isPending}
                                >
                                    إنشاء
                                </Button>
                            </DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="bg-gray-100 p-1 mb-4 flex">
                    <TabsTrigger value="all" className="flex-1">الكل ({layouts.length})</TabsTrigger>
                    <TabsTrigger value="active" className="flex-1">النشطة ({activeScheduled.length + (globalActive ? 1 : 0)})</TabsTrigger>
                    <TabsTrigger value="scheduled" className="flex-1">المجدولة ({scheduled.length})</TabsTrigger>
                    <TabsTrigger value="drafts" className="flex-1">مسودات ({drafts.length})</TabsTrigger>
                </TabsList>

                {['all', 'active', 'scheduled', 'drafts'].map(tab => (
                    <TabsContent key={tab} value={tab} className="mt-0">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-4">
                            {layouts
                                .filter(l => {
                                    if (tab === 'all') return true;
                                    if (tab === 'active') return l.isGlobalActive || activeScheduled.includes(l);
                                    if (tab === 'scheduled') return scheduled.includes(l);
                                    if (tab === 'drafts') return drafts.includes(l);
                                    return false;
                                })
                                .map(layout => {
                                    const isCurrentActiveGlobal = layout.isGlobalActive;
                                    const isScheduledItem = isLayoutScheduled(layout);
                                    const isActiveNow = isLayoutActiveNow(layout);

                                    return (
                                        <Card key={layout.id} className={`flex flex-col relative overflow-hidden transition-all hover:shadow-md ${isActiveNow ? 'ring-2 ring-primary border-primary' : ''}`}>
                                            {isActiveNow && <div className="absolute top-0 right-0 left-0 h-1 bg-primary"></div>}
                                            <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-xl flex items-center gap-2">
                                                        {layout.name}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs">
                                                        تم التحديث: {new Date(layout.updatedAt).toLocaleDateString("ar-EG")}
                                                    </CardDescription>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    {isCurrentActiveGlobal && <Badge variant="default" className="bg-green-600">افتراضي نشط</Badge>}
                                                    {!isCurrentActiveGlobal && isActiveNow && <Badge variant="default" className="bg-primary">مجدول نشط الآن</Badge>}
                                                    {!isCurrentActiveGlobal && isScheduledItem && !isActiveNow && <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-transparent flex items-center gap-1"><Calendar className="w-3 h-3"/>مجدول</Badge>}
                                                    {!isCurrentActiveGlobal && !isScheduledItem && <Badge variant="outline" className="text-gray-500">مسودة</Badge>}
                                                </div>
                                            </CardHeader>
                                            
                                            <CardContent className="flex-1 pb-4">
                                                <LayoutSettingsForm layout={layout} onSave={(payload) => updateMutation.mutate({ id: layout.id, payload })} />
                                            </CardContent>
                                            
                                            <CardFooter className="bg-gray-50 border-t p-3 flex flex-wrap gap-2 justify-between mt-auto">
                                                <Link href={`/admin/customization/${layout.id}`} className="flex-1">
                                                    <Button className="w-full" variant={isActiveNow ? "default" : "secondary"}>
                                                        تعديل الواجهة
                                                    </Button>
                                                </Link>
                                                
                                                <div className="flex gap-1 shrink-0">
                                                    {!isCurrentActiveGlobal && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            title="تعيين كافتراضي نشط"
                                                            onClick={() => {
                                                                if(confirm("سيتم تعيين هذا التخطيط ليكون هو النشط افتراضياً لجميع الزوار. هل أنت متأكد؟")) {
                                                                    updateMutation.mutate({ id: layout.id, payload: { isGlobalActive: true } });
                                                                }
                                                            }}
                                                        >
                                                            <Star className="w-4 h-4 text-emerald-600" />
                                                        </Button>
                                                    )}

                                                    <Dialog open={duplicateTargetId === layout.id} onOpenChange={(open) => {
                                                        if(!open) setDuplicateTargetId(null);
                                                        else { setDuplicateName(`${layout.name} (نسخة)`); setDuplicateTargetId(layout.id); }
                                                    }}>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" title="إنشاء نسخة"><Files className="w-4 h-4 text-blue-600" /></Button>
                                                        </DialogTrigger>
                                                        <DialogContent dir="rtl">
                                                            <DialogHeader>
                                                                <DialogTitle>نسخ التخطيط</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="space-y-4 py-4">
                                                                <Label>اسم النسخة الجديدة</Label>
                                                                <Input value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} />
                                                            </div>
                                                            <DialogFooter>
                                                                <Button variant="outline" onClick={() => setDuplicateTargetId(null)}>إلغاء</Button>
                                                                <Button 
                                                                    onClick={() => { if (duplicateName) duplicateMutation.mutate({ id: layout.id, newName: duplicateName }); }}
                                                                    disabled={!duplicateName || duplicateMutation.isPending}
                                                                >نسخ</Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>

                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="hover:bg-red-100 hover:text-red-700 disabled:opacity-30" 
                                                        disabled={isCurrentActiveGlobal}
                                                        title={isCurrentActiveGlobal ? "لا يمكن حذف التخطيط الافتراضي" : "حذف المسودة"}
                                                        onClick={() => {
                                                            if (!isCurrentActiveGlobal && confirm("هل أنت متأكد من حذف هذه المسودة نهائياً؟")) {
                                                                deleteMutation.mutate(layout.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardFooter>
                                        </Card>
                                    );
                                })}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}

function LayoutSettingsForm({ layout, onSave }: { layout: Layout, onSave: (payload: any) => void }) {
    const [name, setName] = useState(layout.name);
    
    // Convert DB ISO string to local input value
    const formatForInput = (dateStr: string | null) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    const [startDate, setStartDate] = useState(formatForInput(layout.activeStartDate));
    const [endDate, setEndDate] = useState(formatForInput(layout.activeEndDate));
    
    const [days, setDays] = useState<number[]>(layout.activeDays || []);
    const [startHour, setStartHour] = useState<number | ''>(layout.activeStartHour ?? '');
    const [endHour, setEndHour] = useState<number | ''>(layout.activeEndHour ?? '');

    const [isEditing, setIsEditing] = useState(false);

    const isScheduled = (layout.activeStartDate && layout.activeEndDate) || (layout.activeDays && layout.activeDays.length > 0) || (layout.activeStartHour !== null && layout.activeEndHour !== null);

    if (!isEditing) {
        return (
            <div className="space-y-4">
                {isScheduled ? (
                    <div className="text-sm bg-gray-50 border border-gray-100 rounded p-3 text-gray-600 space-y-2">
                        <div className="flex items-center gap-2 mb-1 text-primary"><Clock className="w-4 h-4" /> <strong className="font-semibold text-gray-900">مجدول للظهور:</strong></div>
                        
                        {(layout.activeStartDate && layout.activeEndDate) && (
                            <div className="pr-6 space-y-0.5 text-xs border-r-2 border-primary/20 mr-2">
                                <div><span className="text-gray-400">من:</span> {new Date(layout.activeStartDate).toLocaleString('ar-EG')}</div>
                                <div><span className="text-gray-400">إلى:</span> {new Date(layout.activeEndDate).toLocaleString('ar-EG')}</div>
                            </div>
                        )}
                        
                        {(layout.activeDays && layout.activeDays.length > 0) && (
                            <div className="pr-6 text-xs flex gap-1 items-center border-r-2 border-primary/20 mr-2">
                                <span className="text-gray-400">أيام العرض:</span>
                                {layout.activeDays.map((d) => ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][d]).join('، ')}
                            </div>
                        )}
                        
                        {(layout.activeStartHour !== null && layout.activeEndHour !== null) && (
                            <div className="pr-6 text-xs flex gap-1 items-center border-r-2 border-primary/20 mr-2">
                                <span className="text-gray-400">ساعات العرض:</span>
                                {layout.activeStartHour === 0 ? '12:00 ص' : layout.activeStartHour < 12 ? `${layout.activeStartHour.toString().padStart(2, '0')}:00 ص` : layout.activeStartHour === 12 ? '12:00 م' : `${(layout.activeStartHour - 12).toString().padStart(2, '0')}:00 م`} 
                                <span className="text-gray-300 mx-1">-</span>
                                {layout.activeEndHour === 0 ? '12:00 ص' : layout.activeEndHour < 12 ? `${layout.activeEndHour.toString().padStart(2, '0')}:00 ص` : layout.activeEndHour === 12 ? '12:00 م' : `${(layout.activeEndHour - 12).toString().padStart(2, '0')}:00 م`}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 italic bg-gray-50 p-2 rounded text-center mb-0 border border-transparent">مسودة (غير مجدول للتفعيل)</p>
                )}
                
                <Button variant="outline" size="sm" className="w-full text-xs h-8 border-dashed" onClick={() => setIsEditing(true)}>
                    <Edit className="ml-1 w-3 h-3" /> تعديل إعدادات التفعيل
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 bg-blue-50/50 p-4 rounded-md border border-blue-100">
            <div>
                <Label className="text-xs mb-1 block">اسم التخطيط</Label>
                <Input size={1} className="h-8 text-xs bg-white" value={name} onChange={e => setName(e.target.value)} />
            </div>
            
            {!layout.isGlobalActive && (
                <div className="space-y-4 pt-2 border-t border-blue-100/50">
                    <Label className="text-sm font-semibold text-blue-900 flex items-center gap-1"><Clock className="w-4 h-4"/> ⏰ خيارات الجدولة (اختياري)</Label>
                    
                    {/* Date Range Start/End */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-[11px] text-gray-500 mb-1 block">بدء العرض في تاريخ محدد</Label>
                            <Input type="datetime-local" className="h-8 text-xs px-2 bg-white" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-[11px] text-gray-500 mb-1 block">انتهاء العرض في تاريخ محدد</Label>
                            <Input type="datetime-local" className="h-8 text-xs px-2 bg-white" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>

                    {/* Days of Week */}
                    <div>
                        <Label className="text-[11px] text-gray-500 mb-1.5 block">تخصيص أيام الأسبوع (تكرار أسبوعي)</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {[{ day: 0, label: 'أحد' }, { day: 1, label: 'إثنين' }, { day: 2, label: 'ثلاثاء' }, { day: 3, label: 'أربعاء' }, { day: 4, label: 'خميس' }, { day: 5, label: 'جمعة' }, { day: 6, label: 'سبت' }].map(({ day, label }) => {
                                const isSelected = days.includes(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => {
                                            if (isSelected) setDays(days.filter(d => d !== day));
                                            else setDays([...days, day]);
                                        }}
                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isSelected
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Daily Time Range */}
                    <div>
                        <Label className="text-[11px] text-gray-500 mb-1 block">تخصيص ساعات محددة (تكرار يومي بتوقيت ليبيا)</Label>
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm w-fit">
                            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">الساعة:</span>
                            <select
                                className="text-[11px] bg-transparent focus:outline-none w-20 text-center cursor-pointer font-medium"
                                value={startHour}
                                onChange={(e) => setStartHour(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            >
                                <option value="">من (أي وقت)</option>
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <option key={i} value={i}>
                                        {i === 0 ? '12:00 ص' : i < 12 ? `${i.toString().padStart(2, '0')}:00 ص` : i === 12 ? '12:00 م' : `${(i - 12).toString().padStart(2, '0')}:00 م`}
                                    </option>
                                ))}
                            </select>
                            <span className="text-[11px] text-slate-300">|</span>
                            <select
                                className="text-[11px] bg-transparent focus:outline-none w-20 text-center cursor-pointer font-medium"
                                value={endHour}
                                onChange={(e) => setEndHour(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            >
                                <option value="">إلى (أي وقت)</option>
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <option key={i} value={i}>
                                        {i === 0 ? '12:00 ص' : i < 12 ? `${i.toString().padStart(2, '0')}:00 ص` : i === 12 ? '12:00 م' : `${(i - 12).toString().padStart(2, '0')}:00 م`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {(startDate || endDate) && (!startDate || !endDate) && (
                        <p className="text-[10px] text-red-500 font-medium">ملاحظة: تأكد من إدخال كل من تاريخ البدء والانتهاء.</p>
                    )}
                    {(startHour !== '' || endHour !== '') && (startHour === '' || endHour === '') && (
                        <p className="text-[10px] text-red-500 font-medium">ملاحظة: تأكد من إدخال كل من وقت البدء والانتهاء.</p>
                    )}
                </div>
            )}

            <div className="flex gap-2 pt-3 mt-2 border-t border-blue-100/50">
                <Button className="h-8 text-xs flex-1" onClick={() => {
                    // Validation simple
                    if ((startDate && !endDate) || (!startDate && endDate)) return; 
                    if ((startHour !== '' && endHour === '') || (startHour === '' && endHour !== '')) return;

                    onSave({
                        name,
                        activeStartDate: startDate ? new Date(startDate).toISOString() : null,
                        activeEndDate: endDate ? new Date(endDate).toISOString() : null,
                        activeDays: days.length > 0 ? days : null,
                        activeStartHour: startHour === '' ? null : startHour,
                        activeEndHour: endHour === '' ? null : endHour,
                    });
                    setIsEditing(false);
                }}>إعتماد التعديلات</Button>
                <Button variant="outline" className="h-8 text-xs shrink-0 bg-white" onClick={() => {
                    setName(layout.name);
                    setStartDate(formatForInput(layout.activeStartDate));
                    setEndDate(formatForInput(layout.activeEndDate));
                    setDays(layout.activeDays || []);
                    setStartHour(layout.activeStartHour ?? '');
                    setEndHour(layout.activeEndHour ?? '');
                    setIsEditing(false);
                }}>تراجع</Button>
            </div>
        </div>
    );
}
