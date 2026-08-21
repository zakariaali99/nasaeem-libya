import { NextRequest } from "next/server";
import * as optionController from "@/modules/options/controllers/optionController";

export async function GET(req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
    const { optionId } = await params;
    return optionController.listOptionValues(req, { params: { optionId } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
    const { optionId } = await params;
    return optionController.createOptionValue(req, { params: { optionId } });
}