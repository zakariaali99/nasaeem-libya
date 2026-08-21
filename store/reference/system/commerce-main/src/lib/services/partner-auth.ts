import { db } from "@/lib/db/drizzle";
import { partnerApps, partnerRequestLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export function sha256Hex(input: string) {
    return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmacHex(secret: string, input: string) {
    return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

type PartnerAuthResult =
    | { success: true; partner: typeof partnerApps.$inferSelect }
    | { success: false; error: string; status: number };

export async function verifyPartnerRequest(
    req: Request
): Promise<PartnerAuthResult> {
    const keyId = req.headers.get("X-Api-Key-Id");
    const secret = req.headers.get("X-Api-Secret");
    const idem = req.headers.get("X-Idempotency-Key");

    if (!keyId || !secret || !idem) {
        return { success: false, error: "Missing required auth headers (X-Api-Key-Id, X-Api-Secret, X-Idempotency-Key)", status: 401 };
    }

    const partner = await db.query.partnerApps.findFirst({
        where: (table, { eq }) => eq(table.apiKeyId, keyId)
    });

    if (!partner) {
        return { success: false, error: "Invalid API Key ID", status: 401 };
    }

    if (partner.status !== "active") {
        return { success: false, error: "Partner account is suspended/inactive", status: 403 };
    }

    // Verify the secret by hashing the provided secret and comparing securely with the stored hash
    const inputSecretHash = sha256Hex(secret);

    try {
        const inputBuffer = Buffer.from(inputSecretHash, 'hex');
        const storedBuffer = Buffer.from(partner.apiSecretHash.trim(), 'hex');

        if (inputBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(inputBuffer, storedBuffer)) {
            return { success: false, error: "Invalid API Secret", status: 401 };
        }
    } catch (err) {
        return { success: false, error: "Authentication processing error", status: 500 };
    }

    // Read the body fully as text for content hashing and idempotency
    const reqClone = req.clone();
    const bodyText = await reqClone.text();
    const bodyHash = sha256Hex(bodyText);

    // Idempotency log check
    // Check if request with this idempotency key already exists
    const existingReqLog = await db.query.partnerRequestLog.findFirst({
        where: (table, { eq, and }) => and(
            eq(table.partnerId, partner.id),
            eq(table.idempotencyKey, idem)
        )
    });

    if (existingReqLog) {
        if (existingReqLog.requestHash !== bodyHash) {
            return { success: false, error: "Idempotency key reused with different payload", status: 409 };
        }
        // We would return the cached response, but in middleware we might just signal it.
        // We can add it to the return object.
    }

    // Record Request
    // We'll record it AFTER the process finishes, so returning the info is best.

    return { success: true, partner };
}

export async function logPartnerResponse(
    partnerId: string,
    idempotencyKey: string,
    requestHash: string,
    responseCode: number,
    responseBody: any
) {
    await db.insert(partnerRequestLog).values({
        partnerId,
        idempotencyKey,
        requestHash,
        responseCode,
        responseBody,
    }).onConflictDoNothing(); // if already exists, ignore
}
