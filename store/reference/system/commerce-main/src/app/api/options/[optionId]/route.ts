import { NextRequest } from "next/server";
import * as optionController from "@/modules/options/controllers/optionController";

export async function GET(req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
    const { optionId } = await params;
    return optionController.getOption(req, { params: { optionId } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
    const { optionId } = await params;
    return optionController.updateOption(req, { params: { optionId } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
    const { optionId } = await params;
    return optionController.deleteOption(req, { params: { optionId } });
}
