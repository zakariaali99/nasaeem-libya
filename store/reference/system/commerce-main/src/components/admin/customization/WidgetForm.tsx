"use client";

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Widget, WidgetType, CreateWidgetInput, UpdateWidgetInput, createWidgetSchema, WidgetTargeting, TargetingRule } from '@/modules/customization/types/customizationTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { widgetFieldRenderers } from './widgets';
import { WidgetStyleFields } from './widgets/style-controls';

// Dynamic import for carousel preview (if needed)
// const KeenSlider = dynamic(() => import('keen-slider/react').then(mod => mod.KeenSlider), { ssr: false });

const widgetTypeNames: { [key in WidgetType]: string } = {
    [WidgetType.CAROUSEL]: 'سلايدر صور',
    [WidgetType.TEXT_BLOCK]: 'كتلة نصية',
    [WidgetType.IMAGE]: 'صورة',
    [WidgetType.PRODUCT_LIST]: 'قائمة منتجات',
    [WidgetType.COLLECTION_SHOWCASE]: 'عرض مجموعة',
    [WidgetType.CATEGORY_LIST]: 'قائمة فئات',
    [WidgetType.PHOTO_LINK_GRID]: 'شبكة روابط بالصور',
    [WidgetType.HERO_CTA]: 'قسم بطل مع زر',
    [WidgetType.ANNOUNCEMENT_BAR]: 'شريط إعلان',
    [WidgetType.SPACER]: 'فاصل مسافة',
    [WidgetType.RECENTLY_VIEWED]: 'شوهد مؤخراً',
    [WidgetType.BUY_AGAIN]: 'اشترِ مجدداً',
    [WidgetType.RECOMMENDED_FOR_YOU]: 'مقترح لك',
    [WidgetType.TRENDING_NEAR_YOU]: 'رائج بالقرب منك',
    // [WidgetType.PRODUCT_CAROUSEL]: 'سلايدر منتجات',
    // [WidgetType.CATEGORY_CAROUSEL]: 'سلايدر فئات',
    // [WidgetType.COLLECTION_CAROUSEL]: 'سلايدر مجموعات',
};

const defaultDataByType: Record<WidgetType, any> = {
    [WidgetType.CAROUSEL]: { slides: [], carouselStyle: 'hero' },
    [WidgetType.TEXT_BLOCK]: { content: '' },
    [WidgetType.IMAGE]: { imageUrl: '', altText: '', linkUrl: '' },
    [WidgetType.PRODUCT_LIST]: { productIds: [], title: '', layout: 'grid' },
    [WidgetType.COLLECTION_SHOWCASE]: { collectionId: '', layout: 'grid' },
    [WidgetType.CATEGORY_LIST]: { categoryIds: [], title: '', layout: 'grid' },
    [WidgetType.PHOTO_LINK_GRID]: { title: '', items: [] },
    [WidgetType.HERO_CTA]: { title: '', subtitle: '', buttonLabel: '', buttonUrl: '', alignment: 'center', backgroundImageUrl: '' },
    [WidgetType.ANNOUNCEMENT_BAR]: { title: 'تنبيه', message: '', linkLabel: '', linkUrl: '', dismissible: true, icon: 'megaphone' },
    [WidgetType.SPACER]: { height: 'md' },
    [WidgetType.RECENTLY_VIEWED]: { title: 'شاهدته مؤخراً', limit: 8, layout: 'grid' },
    [WidgetType.BUY_AGAIN]: { title: 'اشترِ مجدداً', limit: 8, layout: 'grid' },
    [WidgetType.RECOMMENDED_FOR_YOU]: { title: 'مقترح لك', limit: 8, layout: 'grid' },
    [WidgetType.TRENDING_NEAR_YOU]: { title: 'رائج في منطقتك', limit: 8, layout: 'grid' },
    // [WidgetType.PRODUCT_CAROUSEL]: { productIds: [], title: '' },
    // [WidgetType.CATEGORY_CAROUSEL]: { categoryIds: [], title: '' },
    // [WidgetType.COLLECTION_CAROUSEL]: { collectionIds: [], title: '' },
};

const defaultStyle = { padding: 'none', borderRadius: 'none', width: 'full' } as const;


const formSchema = createWidgetSchema;

const createWidget = async (data: CreateWidgetInput) => {
    const res = await fetch('/api/customization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'فشل إنشاء العنصر');
    }
    return await res.json();
};

const updateWidget = async (id: string, values: UpdateWidgetInput) => {
    const res = await fetch(`/api/customization/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'فشل تحديث العنصر');
    }
    return await res.json();
};

interface WidgetFormProps {
    widget: Widget | null;
    onClose: () => void;
}

export default function WidgetForm({ widget, onClose }: WidgetFormProps) {
    const queryClient = useQueryClient();

    // Fetch options from API
    const { data: productsData } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const res = await fetch('/api/products');
            if (!res.ok) throw new Error('فشل جلب المنتجات');
            return await res.json();
        }
    });
    const { data: categoriesData } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await fetch('/api/categories');
            if (!res.ok) throw new Error('فشل جلب الفئات');
            return await res.json();
        }
    });
    const { data: collectionsData } = useQuery({
        queryKey: ['collections'],
        queryFn: async () => {
            const res = await fetch('/api/collections');
            if (!res.ok) throw new Error('فشل جلب المجموعات');
            return await res.json();
        }
    });

    // Map API data to react-select options
    const productOptions = Array.isArray(productsData?.data) ? productsData.data.map((p: any) => ({ value: p.id, label: p.name })) : [];
    const categoryOptions = Array.isArray(categoriesData?.data) ? categoriesData.data.map((c: any) => ({ value: c.id, label: c.name })) : [];
    const collectionOptions = Array.isArray(collectionsData?.data) ? collectionsData.data.map((c: any) => ({ value: c.id, label: c.name })) : [];

    const { handleSubmit, control, setValue, watch } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: widget ? {
            ...widget,
            data: widget.data,
            style: widget.style ?? defaultStyle,
            targeting: widget.targeting ?? { enabled: false, rules: [] },
        } : {
            type: WidgetType.TEXT_BLOCK,
            isActive: true,
            order: 0,
            data: defaultDataByType[WidgetType.TEXT_BLOCK],
            style: defaultStyle,
            targeting: { enabled: false, rules: [] },
        },
    });

    // Fetch available segments for targeting
    const { data: segmentsData } = useQuery({
        queryKey: ['segments'],
        queryFn: async () => {
            const res = await fetch('/api/admin/segments');
            if (!res.ok) return { segments: [], authStatuses: [] };
            return await res.json();
        }
    });

    const widgetType = watch('type');

    // Reset data when widget type changes
    useEffect(() => {
        if (widget && widget.type === widgetType) return;
        const fallback = defaultDataByType[widgetType as WidgetType] ?? {};
        setValue('data', fallback);
        setValue('style', defaultStyle);
    }, [widgetType, setValue, widget, defaultStyle]);

    const createMutation = useMutation({
        mutationFn: createWidget,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['widgets'] });
            toast.success("تم إنشاء العنصر بنجاح");
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.message || "فشل إنشاء العنصر");
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string, values: UpdateWidgetInput }) => updateWidget(data.id, data.values),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['widgets'] });
            toast.success("تم تحديث العنصر بنجاح");
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.message || "فشل تحديث العنصر");
        }
    });

    const onSubmit = (data: z.infer<typeof formSchema>) => {
        if (widget) {
            updateMutation.mutate({ id: widget.id, values: data });
        } else {
            createMutation.mutate(data as CreateWidgetInput);
        }
    };

    const rtlSelectStyles = {
        ...{
            input: (provided: any) => ({ ...provided, direction: 'rtl' }),
            menu: (provided: any) => ({ ...provided, direction: 'rtl' }),
            control: (provided: any) => ({ ...provided, direction: 'rtl' }),
            singleValue: (provided: any) => ({ ...provided, direction: 'rtl' }),
            multiValue: (provided: any) => ({ ...provided, direction: 'rtl' }),
        }
    };

    const FieldsComponent = widgetFieldRenderers[widgetType as WidgetType];

    return (
        <Card className="sticky top-24">
            <CardHeader>
                <CardTitle>{widget ? 'تعديل العنصر' : 'إضافة عنصر جديد'}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="type">نوع العنصر</Label>
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <select
                                    {...field}
                                    className="w-full border rounded px-3 py-2 text-right bg-white"
                                    dir="rtl"
                                >
                                    {Object.entries(widgetTypeNames).map(([typeKey, typeLabel]) => (
                                        <option key={typeKey} value={typeKey}>{typeLabel}</option>
                                    ))}
                                </select>
                            )}
                        />
                    </div>

                    {FieldsComponent ? (
                        <FieldsComponent
                            control={control}
                            namePrefix="data"
                            productOptions={productOptions}
                            categoryOptions={categoryOptions}
                            collectionOptions={collectionOptions}
                            rtlSelectStyles={rtlSelectStyles}
                        />
                    ) : (
                        <p>يرجى اختيار نوع العنصر</p>
                    )}

                    <WidgetStyleFields control={control} namePrefix="style" />

                    {/* ── Targeting Section ── */}
                    <TargetingSection control={control} watch={watch} setValue={setValue} segments={segmentsData?.segments || []} />

                    <div className="flex items-center justify-between">
                        <Label htmlFor="isActive">فعال</Label>
                        <Controller
                            name="isActive"
                            control={control}
                            render={({ field }) => (
                                <Switch
                                    id="isActive"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            )}
                        />
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                            {widget ? 'حفظ التغييرات' : 'إنشاء'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

// ── Targeting UI Section ──

function TargetingSection({ control, watch, setValue, segments }: {
    control: any;
    watch: any;
    setValue: any;
    segments: string[];
}) {
    const targeting = watch('targeting') as WidgetTargeting | undefined;
    const isEnabled = targeting?.enabled ?? false;
    const rules = targeting?.rules ?? [];

    const hasAuthRule = rules.some((r: TargetingRule) => r.type === 'auth_status');
    const hasSegmentRule = rules.some((r: TargetingRule) => r.type === 'segment');
    const authRule = rules.find((r: TargetingRule) => r.type === 'auth_status') as Extract<TargetingRule, { type: 'auth_status' }> | undefined;
    const segmentRule = rules.find((r: TargetingRule) => r.type === 'segment') as Extract<TargetingRule, { type: 'segment' }> | undefined;

    const updateRules = (newRules: TargetingRule[]) => {
        setValue('targeting', { enabled: true, rules: newRules });
    };

    return (
        <div className="mt-6 border-t pt-4" dir="rtl">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-base">🎯</span>
                    <Label className="font-semibold">الاستهداف</Label>
                </div>
                <Controller
                    name="targeting.enabled"
                    control={control}
                    render={({ field }) => (
                        <Switch
                            checked={field.value ?? false}
                            onCheckedChange={(checked) => {
                                setValue('targeting', { enabled: checked, rules: checked ? rules : [] });
                            }}
                        />
                    )}
                />
            </div>

            {isEnabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
                    <p className="text-xs text-amber-700">⚠️ هذا العنصر سيظهر فقط للجمهور المحدد أدناه</p>

                    {/* Auth Status Targeting */}
                    <div>
                        <Label className="text-sm">نوع الجمهور</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {[{ value: 'guest', label: 'زوار (غير مسجلين)', icon: '👤' },
                            { value: 'authenticated', label: 'مسجلين', icon: '🔑' }].map(({ value, label, icon }) => {
                                const isSelected = authRule?.value === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => {
                                            const otherRules = rules.filter((r: TargetingRule) => r.type !== 'auth_status');
                                            if (isSelected) {
                                                updateRules(otherRules);
                                            } else {
                                                updateRules([...otherRules, { type: 'auth_status', operator: 'is', value: value as 'guest' | 'authenticated' }]);
                                            }
                                        }}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${isSelected
                                            ? 'bg-black text-white border-black'
                                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <span>{icon}</span> {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Segment Targeting */}
                    {segments.length > 0 && (
                        <div>
                            <Label className="text-sm">شريحة العملاء (RFM)</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {segments.map((seg: string) => {
                                    const isSelected = segmentRule?.value?.includes(seg) ?? false;
                                    return (
                                        <button
                                            key={seg}
                                            type="button"
                                            onClick={() => {
                                                const otherRules = rules.filter((r: TargetingRule) => r.type !== 'segment');
                                                const currentValues = segmentRule?.value ?? [];
                                                const newValues = isSelected
                                                    ? currentValues.filter((v: string) => v !== seg)
                                                    : [...currentValues, seg];
                                                if (newValues.length > 0) {
                                                    updateRules([...otherRules, { type: 'segment', operator: segmentRule?.operator ?? 'in', value: newValues }]);
                                                } else {
                                                    updateRules(otherRules);
                                                }
                                            }}
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${isSelected
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            {seg}
                                        </button>
                                    );
                                })}
                            </div>
                            {hasSegmentRule && (
                                <div className="mt-2">
                                    <select
                                        className="text-xs border rounded px-2 py-1 bg-white"
                                        value={segmentRule?.operator ?? 'in'}
                                        onChange={(e) => {
                                            const otherRules = rules.filter((r: TargetingRule) => r.type !== 'segment');
                                            updateRules([...otherRules, { type: 'segment', operator: e.target.value as 'in' | 'not_in', value: segmentRule?.value ?? [] }]);
                                        }}
                                    >
                                        <option value="in">يشمل هذه الشرائح</option>
                                        <option value="not_in">يستثني هذه الشرائح</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    {rules.length > 0 && (
                        <div className="text-xs text-gray-600 bg-white rounded-lg p-2 border">
                            <span className="font-medium">سيظهر لـ: </span>
                            {rules.map((r: TargetingRule, i: number) => (
                                <span key={i}>
                                    {i > 0 && <span className="text-amber-600 font-bold"> أو </span>}
                                    {r.type === 'auth_status' && (r.value === 'guest' ? '👤 الزوار' : '🔑 المسجلين')}
                                    {r.type === 'segment' && (
                                        <span>
                                            {r.operator === 'not_in' ? 'الكل ماعدا ' : ''}
                                            {r.value.join('، ')}
                                        </span>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
