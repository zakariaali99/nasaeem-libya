import { getWidget, updateWidget, deleteWidget } from "@/modules/customization/controllers/customizationController";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return getWidget(req, { params: { id } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return updateWidget(req, { params: { id } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return deleteWidget(req, { params: { id } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // We no longer use PATCH on this route; return 405
    return new Response("Method Not Allowed", { status: 405 });
}
