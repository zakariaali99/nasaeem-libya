import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { user as userTable } from '@/lib/db/auth-schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const headers = { "Cache-Control": "no-store" };
    // Use Better Auth instance to read the session from the request
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session || !session.user) {
      return NextResponse.json({ user: null }, { status: 200, headers });
    }

    const userId = session.user.id;
    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId));

    if (!users.length) {
      return NextResponse.json({ user: null }, { status: 200, headers });
    }

    const safeUser = users[0];
    return NextResponse.json({ user: safeUser }, { status: 200, headers });
  } catch (error) {
    console.error('Error fetching /api/me:', error);
    return NextResponse.json(
      { user: null, error: 'Failed to fetch user' },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
