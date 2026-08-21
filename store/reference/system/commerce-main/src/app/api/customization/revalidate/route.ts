import { revalidateCustomization } from "@/modules/customization/controllers/customizationController";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    return revalidateCustomization(req);
}
