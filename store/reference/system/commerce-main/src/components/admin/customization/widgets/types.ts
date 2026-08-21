import { Control } from 'react-hook-form';
import { Widget } from '@/modules/customization/types/customizationTypes';

export type SelectOption = { value: string; label: string };

export interface WidgetFieldProps {
  control: Control<any>;
  namePrefix: string; // base path to widget data inside the form
  productOptions?: SelectOption[];
  categoryOptions?: SelectOption[];
  collectionOptions?: SelectOption[];
  rtlSelectStyles?: any;
}

export type WidgetPreviewRenderer<T extends Widget = Widget> = React.ComponentType<{ widget: T; priority?: boolean }>;
