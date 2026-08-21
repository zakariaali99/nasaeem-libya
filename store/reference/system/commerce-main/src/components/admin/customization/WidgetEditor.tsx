"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Widget, WidgetType } from '@/modules/customization/types/customizationTypes';
import WidgetList from './WidgetList';
import WidgetPreview from './WidgetPreview';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Save, Eye, Edit } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { availableWidgets } from '@/modules/customization/utils/widgetRegistry';
import { toast } from 'sonner';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Schema for the entire form
const formSchema = z.object({
    widgets: z.array(z.any()),
});

interface WidgetEditorProps {
    layoutId: string;
    initialWidgets: Widget[];
    productOptions: { value: string; label: string }[];
    categoryOptions: { value: string; label: string }[];
    collectionOptions: { value: string; label: string }[];
}

import { useRouter } from 'next/navigation';

export default function WidgetEditor({
    layoutId,
    initialWidgets,
    productOptions,
    categoryOptions,
    collectionOptions
}: WidgetEditorProps) {
    const queryClient = useQueryClient();
    const router = useRouter(); // Initialize router
    const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

    // Form setup
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            widgets: initialWidgets || [],
        },
    });

    const { control, handleSubmit, reset, getValues } = form;

    // Sync form with initialWidgets when they change (e.g. after refetch)
    useEffect(() => {
        if (initialWidgets) {
            reset({ widgets: initialWidgets });
        }
    }, [initialWidgets, reset]);

    const { fields, append, remove, move } = useFieldArray({
        control,
        name: "widgets",
        keyName: "fieldId", // Used to avoid id collision with DB id
    });

    // Mutations
    const batchUpdateMutation = useMutation({
        mutationFn: async (widgets: Partial<Widget>[]) => {
            const res = await fetch('/api/customization', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(widgets),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'فشل حفظ التغييرات');
            }
            return await res.json();
        },
        onSuccess: () => {
            toast.success("تم حفظ التغييرات");
            queryClient.invalidateQueries({ queryKey: ['widgets'] });
            router.refresh(); // Refresh server data
            // Revalidate store cache
            revalidateMutation.mutate();
        },
        onError: (err: any) => toast.error(err.message || "فشل حفظ التغييرات"),
    });

    const revalidateMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/customization/revalidate', { method: 'POST' });
            if (!res.ok) throw new Error('فشل تحديث المتجر');
            return await res.json();
        },
        onSuccess: () => {
            toast.success("تم تحديث واجهة المتجر");
        },
    });

    // Handlers
    const handleSave = async (data: any) => {
        // Ensure order is correct
        const widgetUpdates = data.widgets.map((w: Widget, index: number) => ({
            ...w,
            order: index
        }));
        batchUpdateMutation.mutate(widgetUpdates);
    };

    const handleAddWidget = (widgetType: WidgetType) => {
        const definition = availableWidgets[widgetType];
        if (!definition) return;

        const initialData: any = { ...definition.defaultSettings };
        // Default IDs for complex widgets
        if (widgetType === WidgetType.COLLECTION_SHOWCASE && collectionOptions.length > 0) {
            initialData.collectionId = collectionOptions[0].value;
        }

        // We create a temporary ID for the UI. The backend will assign a real ID on save if we implement it that way,
        // BUT currently our backend expects existing IDs for updates. 
        // Strategy: We can't really do "batch create" easily with mixed existing/new unless backend supports upsert.
        // Current backend expects `createWidget` for new ones.
        // To support "Global Save" fully including new widgets, we would need to change backend to support upsert/bulk create.
        // FOR NOW: We will stick to the existing "Create immediately" pattern for ADDING, but "Batch Save" for UPDATING content.

        // Actually, to make "Global Save" true, everything should be local state until saved.
        // But that requires backend robust upsert.
        // Let's compromise: Add Widget -> Creates entry in DB immediately (like before).
        // Then we append to form.

        createWidgetMutation.mutate({
            layoutId: layoutId,
            type: widgetType,
            data: initialData,
            order: form.getValues('widgets').length,
            isActive: true,
            style: { paddingX: 'md', paddingY: 'md', width: 'container' }
        });
    };

    const createWidgetMutation = useMutation({
        mutationFn: async (newWidget: any) => {
            const res = await fetch('/api/customization', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newWidget),
            });
            if (!res.ok) throw new Error('فشل إضافة العنصر');
            return await res.json();
        },
        onSuccess: (data) => {
            append(data);
            toast.success("تم إضافة الأداة. يمكنك تعديلها الآن.");
            // Switch to edit tab if on mobile to see the new widget
            setMobileTab('edit');
        },
        onError: () => toast.error("فشل إضافة الأداة")
    });

    const handleDelete = async (index: number) => {
        const widget = form.getValues(`widgets.${index}`);
        if (widget.id) {
            try {
                await fetch(`/api/customization/${widget.id}`, { method: 'DELETE' });
                remove(index);
                toast.success("تم حذف الأداة");
            } catch (e) {
                toast.error("فشل حذف الأداة");
            }
        } else {
            remove(index);
        }
    };

    // Watch widgets for preview
    const watchedWidgets = form.watch('widgets');

    return (
        <div className="h-full flex flex-col" dir="rtl">
            {/* Toolbar */}
            <div className="bg-background/80 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between shrink-0 z-50 sticky top-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">تخصيص الواجهة</h1>

                    {/* Mobile Tabs */}
                    <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as 'edit' | 'preview')} className="md:hidden">
                        <TabsList>
                            <TabsTrigger value="edit" className="gap-2">
                                <Edit className="h-4 w-4" />
                                <span>تحرير</span>
                            </TabsTrigger>
                            <TabsTrigger value="preview" className="gap-2">
                                <Eye className="h-4 w-4" />
                                <span>معاينة</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">إضافة</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 h-96 overflow-y-auto">
                            {Object.entries(availableWidgets).map(([type, def]) => (
                                <DropdownMenuItem key={type} onClick={() => handleAddWidget(type as WidgetType)} className="cursor-pointer">
                                    {def.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        onClick={form.handleSubmit(handleSave)}
                        disabled={batchUpdateMutation.isPending}
                        className="gap-2 min-w-[120px]"
                    >
                        {batchUpdateMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        <span>حفظ وتحديث</span>
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <div className="h-full grid grid-cols-1 md:grid-cols-2">

                    {/* Editor Panel - Hidden on mobile if in preview mode */}
                    <div className={`
                        h-full overflow-y-auto p-4 bg-muted/10 border-l
                        ${mobileTab === 'preview' ? 'hidden md:block' : 'block'}
                    `}>
                        <div className="max-w-2xl mx-auto space-y-6">
                            <WidgetList
                                fields={fields}
                                move={move}
                                form={form}
                                onDelete={handleDelete}
                                productOptions={productOptions}
                                categoryOptions={categoryOptions}
                                collectionOptions={collectionOptions}
                            />
                        </div>
                    </div>

                    {/* Preview Panel - Hidden on mobile if in edit mode */}
                    <div className={`
                        h-full overflow-y-auto bg-gray-100 p-4 sm:p-8
                        ${mobileTab === 'edit' ? 'hidden md:block' : 'block'}
                    `}>
                        <div className="mx-auto transition-all duration-300 bg-white shadow-xl min-h-[500px] max-w-full rounded-lg border">
                            <div className="w-full h-full overflow-hidden rounded-[inherit]">
                                <div className="p-0 space-y-1">
                                    {watchedWidgets.map((widget: Widget) => (
                                        <WidgetPreview key={widget.id} widget={widget} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
