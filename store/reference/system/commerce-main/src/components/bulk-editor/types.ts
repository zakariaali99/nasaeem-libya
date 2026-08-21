import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";

export type CellCoord = {
    rowIndex: number;
    columnId: string;
};

export type BulkEditorColumn<T extends object> = {
    id: string;
    header: string;
    path: keyof T & string;
    inputType?: "text" | "number" | "textarea" | "select" | "switch" | "media";
    placeholder?: string;
    options?: { label: string; value: string | number }[]; // For select input
    parse?: (value: any) => any;
    format?: (value: any) => string;
    meta?: {
        size?: number;
        align?: "left" | "right" | "center";
        pinned?: boolean; // True to freeze this column at the start of the table
    };
};

export type BulkEditorSchema = z.ZodObject<any>;

export type BulkEditorProps<TSchema extends BulkEditorSchema> = {
    schema: TSchema;
    defaultValues: z.infer<TSchema>;
    columns: BulkEditorColumn<z.infer<TSchema>["rows"][number]>[];
    title?: string;
    description?: string;
    onSubmit: (payload: {
        dirtyRows: Array<{ rowIndex: number; id?: string; changes: Record<string, any> }>;
        values: z.infer<TSchema>;
    }) => Promise<void>;
};