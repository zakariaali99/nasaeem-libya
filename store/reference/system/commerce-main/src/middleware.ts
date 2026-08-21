import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rewrite top-level /uploads/* to /api/uploads/* so we can serve files dynamically
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  console.log('Middleware processing request for:', pathname);

  if (pathname.startsWith('/uploads/') || pathname.startsWith('/_next/uploads/')) {
    console.log('Rewriting request to /api/uploads:', pathname);
    const url = req.nextUrl.clone();
    // Use '/api' + pathname so '/uploads/x' becomes '/api/uploads/x' (avoid '/api/uploads/uploads/x')
    url.pathname = '/api' + pathname; // /uploads/... -> /api/uploads/...
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/uploads/:path*'],
};
