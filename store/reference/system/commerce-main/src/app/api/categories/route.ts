import { getCategories, createCategory } from "@/modules/categories/controllers/categoriesController";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    return getCategories(req);
}

export async function POST(req: NextRequest) {
    return createCategory(req);
}
