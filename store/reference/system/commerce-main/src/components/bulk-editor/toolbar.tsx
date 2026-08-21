"use client";

import React from "react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCheck, Columns, Loader2, Undo2, Redo2 } from "lucide-react";
import type { BulkTableMeta } from "./types.internal";

export type BulkEditorToolbarProps = {
	table: Table<any>;
	onSubmit: () => void;
	isSaving: boolean;
	dirtyCount: number;
};

export function BulkEditorToolbar({ table, onSubmit, isSaving, dirtyCount }: BulkEditorToolbarProps) {
	const meta = table.options.meta as BulkTableMeta | undefined;

	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full" dir="rtl">
			<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground w-full sm:w-auto">
				<span className="inline-flex items-center gap-2 font-medium text-foreground ml-2">
					<CheckCheck className="h-4 w-4" />
					{dirtyCount > 0 ? `${dirtyCount} حقل معدل` : "لا تعديلات"}
				</span>

				<div className="h-4 w-[1px] bg-border mx-1" />
				<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!meta?.canUndo} onClick={meta?.undo} title="تراجع (Ctrl+Z)">
					<Undo2 className="h-4 w-4" />
				</Button>
				<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!meta?.canRedo} onClick={meta?.redo} title="إعادة (Ctrl+Y)">
					<Redo2 className="h-4 w-4" />
				</Button>
				<div className="h-4 w-[1px] bg-border mx-1" />

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="gap-2">
							<Columns className="h-4 w-4" />
							الأعمدة
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{table
							.getAllLeafColumns()
							.filter((column) => column.getCanHide())
							.map((column) => (
								<DropdownMenuCheckboxItem
									key={column.id}
									checked={column.getIsVisible()}
									onCheckedChange={(value: boolean) => column.toggleVisibility(!!value)}
								>
									{column.columnDef.header as string}
								</DropdownMenuCheckboxItem>
							))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="flex items-center gap-2 w-full sm:w-auto">
				<Button
					disabled={isSaving || dirtyCount === 0}
					onClick={onSubmit}
					className="min-w-[140px] w-full sm:w-auto"
				>
					{isSaving ? (
						<span className="inline-flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							جاري الحفظ...
						</span>
					) : (
						"حفظ التغييرات"
					)}
				</Button>
			</div>
		</div>
	);
}
