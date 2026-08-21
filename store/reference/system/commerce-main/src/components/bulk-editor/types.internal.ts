import type { CellCoord } from "./types";

export type DragState = {
    active: boolean;
    origin?: CellCoord;
    targetRowIndex?: number;
};

export type BulkTableMeta = {
    focusCell: CellCoord | null;
    selectedKeys: Set<string>;
    handleCellClick: (event: React.MouseEvent, coord: CellCoord) => void;
    moveFocus: (direction: "up" | "down" | "left" | "right") => void;
    beginFill: (coord: CellCoord) => void;
    hoverFill: (rowIndex: number) => void;
    endFill: () => void;
    beginEdit: (coord: CellCoord) => void;
    endEdit: () => void;
    editingCell?: CellCoord | null;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    applyBulkAction: (columnId: string, actionType: "increase" | "decrease" | "percentage" | "set", value: number, applyTo: "all" | "selected") => void;
};