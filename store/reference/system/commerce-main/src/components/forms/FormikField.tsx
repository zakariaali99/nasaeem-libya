import React from 'react';
import { Field, useField } from 'formik';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Info } from "lucide-react";
import { cn } from '@/lib/utils';

// Helper component for Formik fields with shadcn styling and explanations
interface FormikFieldProps {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  explanation?: string;
  as?: any;
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}

export const FormikField: React.FC<FormikFieldProps> = ({ 
  name, 
  label, 
  placeholder, 
  type = 'text', 
  explanation, 
  as: Component = Input, 
  className,
  disabled = false,
  ...props 
}) => {
  // Get field error status from Formik context
  const [field, meta] = useField(name);
  const hasError = meta.touched && meta.error;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={name} className={cn("flex items-center", hasError ? "text-destructive" : "")}>
          {label}
          {explanation && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help mr-2" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs z-50">
                  <p>{explanation}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Label>
      </div>
      <Field
        as={Component}
        id={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "block w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          hasError
            ? "border-destructive focus-visible:ring-destructive/50"
            : "border-input",
          Component === Input && "h-9",
          Component === Textarea && "min-h-[80px] py-2",
          className
        )}
        {...field}
        {...props}
      />
      {hasError ? (
        <div className="text-sm text-destructive flex items-center gap-1 pt-1">
          <AlertCircle className="h-3 w-3" />
          <span>{meta.error}</span>
        </div>
      ) : null}
    </div>
  );
};

export default FormikField;