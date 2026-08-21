import { NextRequest, NextResponse } from 'next/server';
import {
  GET as getCollectionByIdHandler,
  PUT as updateCollectionHandler,
  DELETE as deleteCollectionHandler,
} from '@/modules/collections/controllers/collectionController';

interface RouteContext {
  params: Promise<{
    collectionId: string;
  }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { collectionId } = await context.params;
  return getCollectionByIdHandler(req, { params: { collectionId } });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { collectionId } = await context.params;
  return updateCollectionHandler(req, { params: { collectionId } });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { collectionId } = await context.params;
  return deleteCollectionHandler(req, { params: { collectionId } });
}
