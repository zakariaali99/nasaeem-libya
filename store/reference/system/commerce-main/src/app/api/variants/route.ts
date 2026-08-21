import { getVariants, createVariant } from "@/modules/variants/controllers/variantController";
import { NextRequest } from "next/server";

// Handler for GET requests to list variants
export async function GET(req: NextRequest) {
    return getVariants(req);
}

// Handler for POST requests to create a new variant
export async function POST(req: NextRequest) {
    return createVariant(req);
}