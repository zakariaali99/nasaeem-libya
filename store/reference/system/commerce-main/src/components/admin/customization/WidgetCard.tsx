"use client";

import { Widget, WidgetType, WidgetTargeting, TargetingRule } from '@/modules/customization/types/customizationTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Controller, useWatch } from 'react-hook-form';
import { GripVertical, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import WidgetPreview from './WidgetPreview';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Select from 'react-select';
import { widgetFieldRenderers } from './widgets';
import { WidgetStyleFields } from './widgets/style-controls';

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


interface WidgetCardProps {
    widget: Widget;
    control: any;
    index: number;
    onDelete: (index: number) => void;
    onUpdateWidget: () => Promise<void>;
    isSaving?: boolean;
    isDeleting?: boolean;
    preview: boolean;
    productOptions: { value: string; label: string }[];
    categoryOptions: { value: string; label: string }[];
    collectionOptions: { value: string; label: string }[];
}

export default function WidgetCard({
    widget,
    control,
    index,
    onDelete,
    onUpdateWidget,
    isSaving,
    isDeleting,
    preview,
    productOptions,
    categoryOptions,
    collectionOptions
}: WidgetCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
    const [localIsSaving, setLocalIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleDelete = () => {
        if (confirm('هل أنت متأكد من رغبتك في حذف هذا العنصر؟')) {
            onDelete(index);
        }
    };

    // Save handled globally now

    if (preview) {
        return (
            <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
                <WidgetPreview widget={widget} />
            </div>
        );
    }

    const FieldsComponent = widgetFieldRenderers[widget.type];
    const rtlSelectStyles = {
        input: (provided: any) => ({ ...provided, direction: 'rtl' }),
        menu: (provided: any) => ({ ...provided, direction: 'rtl' }),
        control: (provided: any) => ({ ...provided, direction: 'rtl' }),
        singleValue: (provided: any) => ({ ...provided, direction: 'rtl' }),
        multiValue: (provided: any) => ({ ...provided, direction: 'rtl' }),
    };

    return (
        <Card ref={setNodeRef} style={style} className="touch-none overflow-hidden border-2 transition-colors hover:border-border/80">
            <div className="z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 border-b px-6 py-4 flex flex-row items-center justify-between gap-4">
                <div {...attributes} {...listeners} className="flex flex-row items-center gap-3 cursor-move flex-1 group">
                    <GripVertical className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <CardTitle className="text-lg font-medium">{widgetTypeNames[widget.type]}</CardTitle>
                    {widget.targeting?.enabled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800" title="استهداف مفعّل">
                            🎯
                        </span>
                    )}
                    {[WidgetType.RECENTLY_VIEWED, WidgetType.BUY_AGAIN, WidgetType.RECOMMENDED_FOR_YOU, WidgetType.TRENDING_NEAR_YOU].includes(widget.type) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800" title="محتوى مخصص لكل مستخدم">
                            👤
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="flex items-center gap-2 mr-2 border-l pl-4 border-border/50">
                        <Label htmlFor={`isActive-${widget.id}`} className="text-sm font-normal text-muted-foreground cursor-pointer">
                            {widget.isActive ? 'فعال' : 'غير فعال'}
                        </Label>
                        <Controller
                            name={`widgets.${index}.isActive`}
                            control={control}
                            render={({ field }) => (
                                <Switch
                                    id={`isActive-${widget.id}`}
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={localIsSaving || isDeleting}
                                />
                            )}
                        />
                    </div>

                    {/* Save button removed */}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDelete}
                        disabled={localIsSaving || isDeleting}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <CardContent>
                {FieldsComponent ? (
                    <FieldsComponent
                        control={control}
                        namePrefix={`widgets.${index}.data`}
                        productOptions={productOptions}
                        categoryOptions={categoryOptions}
                        collectionOptions={collectionOptions}
                        rtlSelectStyles={rtlSelectStyles}
                    />
                ) : (
                    <p>يرجى اختيار نوع العنصر</p>
                )}

                <div className="mt-8 border-t pt-6 bg-muted/20 -mx-6 px-6 pb-2 rounded-b-lg">
                    <h4 className="text-sm font-medium mb-4 text-muted-foreground">تخصيص المظهر</h4>
                    <WidgetStyleFields control={control} namePrefix={`widgets.${index}.style`} />
                </div>

                {/* Targeting Section */}
                <TargetingCardSection control={control} index={index} />

                {error && <p className="text-sm text-red-600 mt-4 bg-red-50 p-2 rounded border border-red-200">{error}</p>}
            </CardContent>
        </Card>
    );
}

// ── Targeting UI for WidgetCard ──

function TargetingCardSection({ control, index }: { control: any; index: number }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { data: segmentsData } = useQuery({
        queryKey: ['segments'],
        queryFn: async () => {
            const res = await fetch('/api/admin/segments');
            if (!res.ok) return { segments: [], cities: [] };
            return await res.json();
        },
        staleTime: Infinity,
    });
    const segments: string[] = segmentsData?.segments ?? [];
    const availableCities: string[] = segmentsData?.cities ?? [];

    return (
        <Controller
            name={`widgets.${index}.targeting`}
            control={control}
            render={({ field }) => {
                const targeting = (field.value as WidgetTargeting) ?? { enabled: false, rules: [] };
                const isEnabled = targeting.enabled ?? false;
                const rules: TargetingRule[] = targeting.rules ?? [];

                const authRule = rules.find((r) => r.type === 'auth_status') as Extract<TargetingRule, { type: 'auth_status' }> | undefined;
                const segmentRule = rules.find((r) => r.type === 'segment') as Extract<TargetingRule, { type: 'segment' }> | undefined;
                const timeRule = rules.find((r) => r.type === 'time_range') as Extract<TargetingRule, { type: 'time_range' }> | undefined;
                const regionRule = rules.find((r) => r.type === 'region') as Extract<TargetingRule, { type: 'region' }> | undefined;

                const updateRules = (newRules: TargetingRule[]) => {
                    field.onChange({ enabled: true, rules: newRules });
                };

                const summaryRender = rules.length > 0 ? (
                    <div className="text-xs text-gray-600 bg-white rounded p-2 border mt-2">
                        <span className="font-medium">سيظهر لـ: </span>
                        {rules.map((r, i) => (
                            <span key={i}>
                                {i > 0 && <span className="text-amber-600 font-bold"> أو </span>}
                                {r.type === 'auth_status' && (r.value === 'guest' ? '👤 الزوار' : '🔑 المسجلين')}
                                {r.type === 'segment' && (
                                    <span>{r.operator === 'not_in' ? 'الكل ماعدا ' : ''}{r.value.join('، ')}</span>
                                )}
                                {r.type === 'time_range' && (
                                    <span>⏰ {r.value.days && r.value.days.length > 0 ? `أيام ${r.value.days.map((d: number) => ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][d]).join('، ')}` : ''}{r.value.startHour !== undefined ? ` ${r.value.startHour}:00-${r.value.endHour}:00` : ''}{r.value.startDate ? ` من ${r.value.startDate}` : ''}{r.value.endDate ? ` إلى ${r.value.endDate}` : ''}</span>
                                )}
                                {r.type === 'region' && (
                                    <span>📍 {r.operator === 'not_in' ? 'الكل ماعدا ' : ''}{r.value.join('، ')}</span>
                                )}
                            </span>
                        ))}
                    </div>
                ) : null;

                return (
                    <div className="mt-6 border-t pt-4 -mx-6 px-6" dir="rtl">
                        <div className="flex items-center justify-between mb-3">
                            <button
                                type="button"
                                onClick={() => isEnabled && setIsExpanded(!isExpanded)}
                                className="flex items-center gap-2 flex-1 text-right"
                            >
                                <span className="text-base">🎯</span>
                                <Label className={`font-semibold text-sm ${isEnabled ? 'cursor-pointer' : ''}`}>الاستهداف</Label>
                                {isEnabled && (
                                    isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                            </button>
                            <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => {
                                    field.onChange({ enabled: checked, rules: checked ? rules : [] });
                                    if (checked) setIsExpanded(true);
                                }}
                            />
                        </div>

                        {isEnabled && !isExpanded && summaryRender}

                        {isEnabled && isExpanded && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-6 mb-2">
                                <p className="text-sm text-slate-500 mb-2">قم بتحديد وشمل أو إستثناء الفئات التي سيظهر لها هذا العنصر:</p>

                                {/* Auth Status */}
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-700 font-semibold mb-1 block">الزوار والمسجلين</Label>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {[{ value: 'guest' as const, label: 'زوار', icon: '👤' },
                                        { value: 'authenticated' as const, label: 'مسجلين', icon: '🔑' }].map(({ value, label, icon }) => {
                                            const isSelected = authRule?.value === value;
                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => {
                                                        const otherRules = rules.filter((r) => r.type !== 'auth_status');
                                                        if (isSelected) {
                                                            updateRules(otherRules);
                                                        } else {
                                                            updateRules([...otherRules, { type: 'auth_status', operator: 'is', value }]);
                                                        }
                                                    }}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${isSelected
                                                        ? 'bg-black text-white border-black'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                                        }`}
                                                >
                                                    {icon} {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Segments */}
                                {segments.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-700 font-semibold mb-1 block">شريحة العملاء</Label>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {segments.map((seg: string) => {
                                                const isSelected = segmentRule?.value?.includes(seg) ?? false;
                                                return (
                                                    <button
                                                        key={seg}
                                                        type="button"
                                                        onClick={() => {
                                                            const otherRules = rules.filter((r) => r.type !== 'segment');
                                                            const currentValues = segmentRule?.value ?? [];
                                                            const newValues = isSelected
                                                                ? currentValues.filter((v) => v !== seg)
                                                                : [...currentValues, seg];
                                                            if (newValues.length > 0) {
                                                                updateRules([...otherRules, { type: 'segment', operator: segmentRule?.operator ?? 'in', value: newValues }]);
                                                            } else {
                                                                updateRules(otherRules);
                                                            }
                                                        }}
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border transition-colors ${isSelected
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                                            }`}
                                                    >
                                                        {seg}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {segmentRule && (
                                            <select
                                                className="text-xs border rounded px-2 py-1 bg-white mt-1.5"
                                                value={segmentRule.operator}
                                                onChange={(e) => {
                                                    const otherRules = rules.filter((r) => r.type !== 'segment');
                                                    updateRules([...otherRules, { type: 'segment', operator: e.target.value as 'in' | 'not_in', value: segmentRule.value }]);
                                                }}
                                            >
                                                <option value="in">يشمل</option>
                                                <option value="not_in">يستثني</option>
                                            </select>
                                        )}
                                    </div>
                                )}

                                {/* Time Range */}
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-700 font-semibold mb-1 block">⏰ أوقات العرض المخصصة</Label>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {[{ day: 0, label: 'أحد' }, { day: 1, label: 'إثنين' }, { day: 2, label: 'ثلاثاء' }, { day: 3, label: 'أربعاء' }, { day: 4, label: 'خميس' }, { day: 5, label: 'جمعة' }, { day: 6, label: 'سبت' }].map(({ day, label }) => {
                                            const isSelected = timeRule?.value?.days?.includes(day) ?? false;
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => {
                                                        const otherRules = rules.filter((r) => r.type !== 'time_range');
                                                        const currentDays = timeRule?.value?.days ?? [];
                                                        const newDays = isSelected
                                                            ? currentDays.filter((d) => d !== day)
                                                            : [...currentDays, day];
                                                        const timeVal = { ...timeRule?.value, days: newDays };
                                                        if (newDays.length > 0 || timeVal.startHour !== undefined) {
                                                            updateRules([...otherRules, { type: 'time_range', operator: 'between', value: timeVal }]);
                                                        } else {
                                                            updateRules(otherRules);
                                                        }
                                                    }}
                                                    className={`px-2 py-1 rounded-full text-xs border transition-colors ${isSelected
                                                        ? 'bg-orange-500 text-white border-orange-500'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                                        }`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1">
                                            <span className="text-xs text-slate-500 font-medium">الوقت:</span>
                                            <select
                                                className="text-xs bg-transparent focus:outline-none w-24 text-center cursor-pointer"
                                                value={timeRule?.value?.startHour ?? ''}
                                                onChange={(e) => {
                                                    const otherRules = rules.filter((r) => r.type !== 'time_range');
                                                    const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                                    const timeVal = { ...timeRule?.value, startHour: val };
                                                    if (val !== undefined || (timeVal.days && timeVal.days.length > 0)) {
                                                        updateRules([...otherRules, { type: 'time_range', operator: 'between', value: timeVal }]);
                                                    } else {
                                                        updateRules(otherRules);
                                                    }
                                                }}
                                            >
                                                <option value="">من (أي وقت)</option>
                                                {Array.from({ length: 24 }).map((_, i) => (
                                                    <option key={i} value={i}>
                                                        {i === 0 ? '12:00 ص' : i < 12 ? `${i.toString().padStart(2, '0')}:00 ص` : i === 12 ? '12:00 م' : `${(i - 12).toString().padStart(2, '0')}:00 م`}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="text-xs text-slate-300">|</span>
                                            <select
                                                className="text-xs bg-transparent focus:outline-none w-24 text-center cursor-pointer"
                                                value={timeRule?.value?.endHour ?? ''}
                                                onChange={(e) => {
                                                    const otherRules = rules.filter((r) => r.type !== 'time_range');
                                                    const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                                    const timeVal = { ...timeRule?.value, endHour: val };
                                                    if (val !== undefined || (timeVal.days && timeVal.days.length > 0)) {
                                                        updateRules([...otherRules, { type: 'time_range', operator: 'between', value: timeVal }]);
                                                    } else {
                                                        updateRules(otherRules);
                                                    }
                                                }}
                                            >
                                                <option value="">إلى (أي وقت)</option>
                                                {Array.from({ length: 24 }).map((_, i) => (
                                                    <option key={i} value={i}>
                                                        {i === 0 ? '12:00 ص' : i < 12 ? `${i.toString().padStart(2, '0')}:00 ص` : i === 12 ? '12:00 م' : `${(i - 12).toString().padStart(2, '0')}:00 م`}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="text-xs text-slate-400 italic mx-1 hidden sm:inline">(غرينتش +2)</span>
                                        </div>

                                        <div className="flex items-center gap-2 bg-white border rounded-md px-2 py-1">
                                            <span className="text-xs text-slate-500 font-medium">التاريخ:</span>
                                            <input
                                                type="date"
                                                className="text-xs bg-transparent focus:outline-none cursor-pointer"
                                                value={timeRule?.value?.startDate ?? ''}
                                                max={timeRule?.value?.endDate ?? ''}
                                                onChange={(e) => {
                                                    const otherRules = rules.filter((r) => r.type !== 'time_range');
                                                    const timeVal = { ...timeRule?.value, startDate: e.target.value || undefined };
                                                    updateRules([...otherRules, { type: 'time_range', operator: 'between', value: timeVal }]);
                                                }}
                                            />
                                            <span className="text-xs text-slate-300">|</span>
                                            <input
                                                type="date"
                                                className="text-xs bg-transparent focus:outline-none cursor-pointer"
                                                value={timeRule?.value?.endDate ?? ''}
                                                min={timeRule?.value?.startDate ?? ''}
                                                onChange={(e) => {
                                                    const otherRules = rules.filter((r) => r.type !== 'time_range');
                                                    const timeVal = { ...timeRule?.value, endDate: e.target.value || undefined };
                                                    updateRules([...otherRules, { type: 'time_range', operator: 'between', value: timeVal }]);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Region */}
                                {availableCities.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-700 font-semibold mb-1 block">📍 المنطقة / المدينة</Label>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <Select
                                                    isMulti
                                                    options={availableCities.map((city) => ({ value: city, label: city }))}
                                                    value={regionRule?.value?.map((city) => ({ value: city, label: city })) || []}
                                                    onChange={(selected: any) => {
                                                        const otherRules = rules.filter((r) => r.type !== 'region');
                                                        const newValues = selected ? selected.map((s: any) => s.value) : [];
                                                        if (newValues.length > 0) {
                                                            updateRules([...otherRules, { type: 'region', operator: regionRule?.operator ?? 'in', value: newValues }]);
                                                        } else {
                                                            updateRules(otherRules);
                                                        }
                                                    }}
                                                    placeholder="ابحث عن مدينة..."
                                                    noOptionsMessage={() => "لا توجد نتائج"}
                                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                    menuPosition="fixed"
                                                    styles={{
                                                        input: (provided: any) => ({ ...provided, direction: 'rtl' }),
                                                        menu: (provided: any) => ({ ...provided, direction: 'rtl', fontSize: '0.875rem' }),
                                                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                        control: (provided: any) => ({ ...provided, direction: 'rtl', fontSize: '0.875rem', borderColor: '#E2E8F0', borderRadius: '0.375rem', minHeight: '36px' }),
                                                        singleValue: (provided: any) => ({ ...provided, direction: 'rtl' }),
                                                        multiValue: (provided: any) => ({ ...provided, direction: 'rtl' }),
                                                    }}
                                                />
                                            </div>
                                            {regionRule && regionRule.value.length > 0 && (
                                                <select
                                                    className="text-sm border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-300 bg-white text-slate-700 border-slate-200 w-32 shrink-0 h-[38px]"
                                                    value={regionRule.operator}
                                                    onChange={(e) => {
                                                        const otherRules = rules.filter((r) => r.type !== 'region');
                                                        updateRules([...otherRules, { type: 'region', operator: e.target.value as 'in' | 'not_in', value: regionRule.value }]);
                                                    }}
                                                >
                                                    <option value="in">يشمل</option>
                                                    <option value="not_in">يستثني</option>
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Summary */}
                                {summaryRender}
                            </div>
                        )}
                    </div>
                );
            }}
        />
    );
}
