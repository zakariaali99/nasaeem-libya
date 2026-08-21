import { NextRequest } from "next/server";
import * as optionController from "@/modules/options/controllers/optionController";

export async function GET(req: NextRequest) {
    return optionController.listOptions(req);
}

export async function POST(req: NextRequest) {
    return optionController.createOption(req);
}
