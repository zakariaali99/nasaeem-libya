import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Minimal mime map; extend if you need more types
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

export async function GET(request: Request, context: any = {}) {
  // `params` in Next.js app routes is a special object that must be awaited
  // before accessing properties. Awaiting it prevents the E307 sync-dynamic-apis error.
  const params = await context.params;
  const fileParam = params?.file ?? [];
  console.log('Serving uploaded file:', fileParam);

  try {
    const relPath = Array.isArray(fileParam) ? fileParam.join('/') : String(fileParam || '');

    if (!relPath) {
      return NextResponse.json({ message: 'ملف غير محدد' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const resolvedPath = path.normalize(path.join(uploadsDir, relPath));

    // Prevent path traversal
    if (!resolvedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ message: 'غير مسموح بالوصول إلى هذا المسار' }, { status: 403 });
    }

    const stat = await fs.promises.stat(resolvedPath).catch((e) => {
      if ((e as any)?.code === 'ENOENT') return null;
      throw e;
    });

    if (!stat || !stat.isFile()) {
      return NextResponse.json({ message: 'الملف غير موجود' }, { status: 404 });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  // Read the file into memory and return as ArrayBuffer. This keeps the handler
  // compatible with Next's Response/NextResponse types. For very large files you
  // may want to stream via Web Streams, but reading into memory is simpler and
  // acceptable for most upload sizes (images, PDFs, etc.).
  const data = await fs.promises.readFile(resolvedPath);

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(stat.size));
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  // Convert Node Buffer to Uint8Array which is a valid BodyInit type
  const body = new Uint8Array(data);
  return new NextResponse(body, { status: 200, headers });
  } catch (error) {
    console.error('Error serving uploaded file:', error);
    return NextResponse.json({ message: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
