import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role, ROLES } from "@/lib/rbac";

export type AuthResult =
    | { success: true; session: any; response?: undefined }
    | { success: false; response: NextResponse; session: null };

/**
 * Validates the request against the allowed roles.
 * 
 * @param req The NextRequest object
 * @param allowedRoles Array of roles allowed to access the route. If empty, any authenticated user is allowed (unless allowPublic is true).
 * @param allowPublic If true, allows unauthenticated users (returns success=true, session=null). Also bypasses role checks for authenticated users.
 */
export async function validateRequest(
    req: NextRequest,
    allowedRoles: Role[] = [],
    allowPublic: boolean = false
): Promise<AuthResult> {
    const session = await auth.api.getSession({
        headers: req.headers,
    });

    if (!session || !session.user) {
        if (allowPublic) {
            return { success: true, session: null };
        }
        return { success: false, response: NextResponse.json({ message: "غير مصرح" }, { status: 401 }), session: null };
    }

    const userRole = session.user.role as Role;

    // Public routes allow everyone, including logged in users regardless of role
    if (allowPublic) {
        return { success: true, session };
    }

    // Owner always has access
    if (userRole === ROLES.OWNER) {
        return { success: true, session };
    }

    // If roles are specified, check if user has one of them
    if (allowedRoles.length > 0) {
        if (!allowedRoles.includes(userRole)) {
            return { success: false, response: NextResponse.json({ message: "غير مصرح: ليس لديك الصلاحية" }, { status: 403 }), session: null };
        }
    }

    // If no specific roles required, any authenticated user is allowed
    return { success: true, session };
}
