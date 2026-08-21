import { NextRequest } from "next/server";
import { bulkUpdate } from "@/modules/products/controllers/productController";

export async function PATCH(req: NextRequest) {
    return bulkUpdate(req);
}
