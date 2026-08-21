"use client";

import { Widget, WidgetType } from '@/modules/customization/types/customizationTypes';
import WidgetCard from './WidgetCard';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useFieldArray, UseFormReturn } from 'react-hook-form';

interface WidgetListProps {
    fields: any[];
    move: (from: number, to: number) => void;
    // form: UseFormReturn<any>; // Just keeping control in form for WidgetCard? WidgetCard needs control.
    form: UseFormReturn<any>;
    onDelete: (index: number) => void;
    productOptions: { value: string; label: string }[];
    categoryOptions: { value: string; label: string }[];
    collectionOptions: { value: string; label: string }[];
}

export default function WidgetList({
    fields,
    move,
    form,
    onDelete,
    productOptions,
    categoryOptions,
    collectionOptions
}: WidgetListProps) {
    const { control } = form; // getValues removed as not needed? check below. handleDragEnd uses indices.

    // Removed internal useFieldArray

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const oldIndex = fields.findIndex((field: any) => field.id === active.id);
            const newIndex = fields.findIndex((field: any) => field.id === over.id);
            move(oldIndex, newIndex);
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f: any) => f.id || f.fieldId)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                    {fields.map((field: any, index) => (
                        <WidgetCard
                            key={field.id || field.fieldId}
                            control={control}
                            index={index}
                            widget={field as unknown as Widget}
                            onDelete={() => onDelete(index)}
                            isSaving={false}
                            isDeleting={false}
                            // No longer need onUpdateWidget as form state is global
                            onUpdateWidget={async () => { }}
                            preview={false}
                            productOptions={productOptions}
                            categoryOptions={categoryOptions}
                            collectionOptions={collectionOptions}
                        />
                    ))}
                </div>
            </SortableContext>
            {fields.length === 0 && (
                <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
                    <p className="text-muted-foreground">لا توجد أدوات مضافة بعد. استخدم زر "إضافة" في القائمة العلوية.</p>
                </div>
            )}
        </DndContext>
    );
}
