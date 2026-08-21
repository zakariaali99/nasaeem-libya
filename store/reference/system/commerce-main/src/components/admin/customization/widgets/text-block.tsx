"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import { TextBlockEditor, TextBlockPreview } from '../TextBlockComponents';
import { TextBlockWidget, WidgetType } from '@/modules/customization/types/customizationTypes';
import { WidgetFieldProps, WidgetPreviewRenderer } from './types';

export const TextBlockFields: React.FC<WidgetFieldProps> = ({ control, namePrefix }) => (
  <Controller
    name={`${namePrefix}.content`}
    control={control}
    render={({ field }) => (
      <TextBlockEditor
        value={typeof field.value === 'string' ? field.value : ''}
        onChange={field.onChange}
      />
    )}
  />
);

export const TextBlockPreviewRenderer: WidgetPreviewRenderer<TextBlockWidget> = ({ widget }) => (
  <TextBlockPreview value={widget.data.content} />
);

export const textBlockDefinition = {
  type: WidgetType.TEXT_BLOCK,
  Fields: TextBlockFields,
  Preview: TextBlockPreviewRenderer,
};
