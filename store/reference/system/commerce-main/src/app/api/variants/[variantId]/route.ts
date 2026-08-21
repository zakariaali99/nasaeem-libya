import { getVariant, updateVariant, deleteVariant } from "@/modules/variants/controllers/variantController";
import { NextRequest } from "next/server";

// Define the context type including params
interface Context {
    params: Promise<{ variantId: string }>;
}

// Handler for GET requests to fetch a single variant by ID
export async function GET(req: NextRequest, context: Context) {
    const { variantId } = await context.params;
    return getVariant(req, { params: { variantId } });
}

// Handler for PUT requests to update a variant by ID
export async function PUT(req: NextRequest, context: Context) {
    const { variantId } = await context.params;
    return updateVariant(req, { params: { variantId } });
}

// Handler for DELETE requests to delete a variant by ID
export async function DELETE(req: NextRequest, context: Context) {
    const { variantId } = await context.params;
    return deleteVariant(req, { params: { variantId } });
}