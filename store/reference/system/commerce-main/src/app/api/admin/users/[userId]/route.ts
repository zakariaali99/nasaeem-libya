import { NextResponse } from "next/server";
import { auth } from "@/lib/auth"
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle"; // adjust the path as needed for your Drizzle DB connection
import { user, session } from "@/lib/db/auth-schema";

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;

    const hasPermission = await auth.api.userHasPermission({
        body: {
            userId: userId,
            permission: {
                user: ["list"]
            }
        }
    });

    if (!hasPermission.success) {
      return NextResponse.json({ error: "ليس لديك الإذن لعرض هذا المستخدم" }, { status: 403 });
    }

    // Query to get the user details from the "user" table
    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (!userData) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    // Query to get the most recent session (e.g., last login) for the user
    const [latestSession] = await db
      .select({
        lastLoginAt: sql`MAX(${session.createdAt})`
      })
      .from(session)
      .where(eq(session.userId, userId));

    // Construct the response by combining user data with the last login information.
    const result = {
      ...userData,
      phoneNumber: userData.phoneNumber,
      lastLoginAt: latestSession?.lastLoginAt || null,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json({ error: "خطأ في الخادم الداخلي" }, { status: 500 });
  }
}