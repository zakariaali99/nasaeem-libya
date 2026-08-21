import React from 'react';
import { Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';
import { SpacerWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { cn } from '@/lib/utils';

export const SpacerFields: React.FC<WidgetFieldProps> = ({ control, namePrefix }) => {
    return (
        <div className="space-y-8" dir="rtl">
            <Controller
                name={`${namePrefix}.height`}
                control={control}
                render={({ field }) => (
                    <div className="space-y-8">
                        <Label>ارتفاع الفاصل</Label>
                        <select
                            {...field}
                            value={field.value ?? 'md'}
                            className="w-full border rounded px-3 py-2 bg-background"
                        >
                            <option value="sm">صغير (16px)</option>
                            <option value="md">متوسط (32px)</option>
                            <option value="lg">كبير (64px)</option>
                            <option value="xl">كبير جداً (128px)</option>
                            <option value="2xl">ضخم (256px)</option>
                        </select>
                    </div>
                )}
            />
        </div>
    );
};

const heightMap: Record<string, string> = {
    sm: 'h-4',   // 16px
    md: 'h-8',   // 32px
    lg: 'h-16',  // 64px
    xl: 'h-32',  // 128px
    '2xl': 'h-64' // 256px
};

export const SpacerPreview: React.FC<{ widget: SpacerWidget }> = ({ widget }) => {
    const height = widget.data?.height || 'md';
    const heightClass = heightMap[height] || heightMap.md;

    return (
        <div className={cn("w-full transition-all", heightClass)} aria-hidden="true" />
    );
};

export const SpacerPreviewRenderer: WidgetPreviewRenderer<SpacerWidget> = ({ widget }) => (
    <SpacerPreview widget={widget} />
);

export const spacerDefinition = {
    type: WidgetType.SPACER,
    Fields: SpacerFields,
    Preview: SpacerPreviewRenderer,
};
