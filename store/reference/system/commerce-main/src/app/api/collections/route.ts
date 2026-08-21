import { NextRequest, NextResponse } from 'next/server';
import {
  GET as getAllCollectionsHandler,
  POST as createCollectionHandler,
} from '@/modules/collections/controllers/collectionController';

export async function GET(req: NextRequest) {
  return getAllCollectionsHandler(req);
}

export async function POST(req: NextRequest) {
  return createCollectionHandler(req);
}
