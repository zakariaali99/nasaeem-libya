import { NextRequest, NextResponse } from 'next/server';
import {
  GET_PRODUCTS as getProductsInCollectionHandler,
  POST_PRODUCTS as addProductsToCollectionHandler,
  DELETE_PRODUCTS as removeProductsFromCollectionHandler,
} from '@/modules/collections/controllers/collectionController';

interface RouteContext {
  params: Promise<{
    collectionId: string;
  }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  return getProductsInCollectionHandler(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return addProductsToCollectionHandler(req, context);
}

// Note: For DELETE, Next.js route handlers typically receive the body via req.json()
// The DELETE_PRODUCTS handler in the controller is designed to parse productIds from the body.
export async function DELETE(req: NextRequest, context: RouteContext) {
  return removeProductsFromCollectionHandler(req, context);
}
