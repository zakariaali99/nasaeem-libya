"use client";

import React from 'react';
import { Widget } from '@/modules/customization/types/customizationTypes';
import { widgetPreviewRenderers } from './widgets';
import { WidgetShell } from './widgets/style-shell';

interface WidgetPreviewProps {
    widget: Widget;
    priority?: boolean;
}

export default function WidgetPreview({ widget, priority = false }: WidgetPreviewProps) {
    if (!widget.isActive) return null;

    const PreviewComponent = widgetPreviewRenderers[widget.type];

    return (
        <>
            {PreviewComponent ? (
                <WidgetShell style={widget.style}>
                    <PreviewComponent widget={widget as any} priority={priority} />
                </WidgetShell>
            ) : (
                <div className="p-4 bg-red-100 text-red-800 rounded">نوع أداة غير معروف</div>
            )}
        </>
    );
}
