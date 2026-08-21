import { getWidgets, createWidget, updateWidgetOrder } from "@/modules/customization/controllers/customizationController";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    return getWidgets(req);
}

export async function POST(req: NextRequest) {
    return createWidget(req);
}

export async function PUT(req: NextRequest) {
    return updateWidgetOrder(req);
}
