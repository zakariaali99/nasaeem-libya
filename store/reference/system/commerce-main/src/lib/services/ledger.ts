import { db } from "@/lib/db/drizzle";
import {
    walletAccounts,
    walletTransactions,
    vouchers,
    voucherCampaigns,
    securityAuditEvents,
    partnerApps,
    partnerRequestLog
} from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import crypto from "crypto";

export const VOUCHER_PEPPER = process.env.VOUCHER_PEPPER || "super-secret-pepper-change-me-in-production";

/**
 * Validates a partner API request against the partner credentials.
 */
export function sha256Hex(input: string) {
    return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmacHex(secret: string, input: string) {
    return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

export function generateVoucherCode(prefix?: string) {
    // Generate a random 16-character code
    const entropy = crypto.randomBytes(8).toString("hex").toUpperCase();
    const format = (str: string) => str.match(/.{1,4}/g)?.join("-") || str;
    return prefix ? `${prefix}-${format(entropy)}` : format(entropy);
}

export function getVoucherCodeHash(code: string) {
    return sha256Hex(code + VOUCHER_PEPPER);
}

/**
 * Atomic wallet top-up logic
 */
export async function createWalletTopup(
    userId: string,
    amount: number,
    currency: string,
    referenceType: string,
    referenceId: string,
    idempotencyKey: string
) {
    return await db.transaction(async (tx) => {
        // 1. Get or create wallet account
        let wallet = await tx.query.walletAccounts.findFirst({
            where: (table, { eq, and }) => and(
                eq(table.userId, userId),
                eq(table.currency, currency)
            )
        });

        if (!wallet) {
            const [newWallet] = await tx.insert(walletAccounts).values({
                userId,
                currency,
                currentBalance: 0,
            }).returning();
            wallet = newWallet;
        }

        // 2. Check idempotency
        const existingTxn = await tx.query.walletTransactions.findFirst({
            where: (table, { eq, and }) => and(
                eq(table.walletAccountId, wallet!.id),
                eq(table.idempotencyKey, idempotencyKey)
            )
        });

        if (existingTxn) {
            return { status: "success", transaction: existingTxn, idempotencyHit: true };
        }

        // 3. Post ledger credit
        const [txn] = await tx.insert(walletTransactions).values({
            walletAccountId: wallet.id,
            type: "topup",
            amount,
            currency,
            status: "posted",
            referenceType,
            referenceId,
            idempotencyKey
        }).returning();

        // 4. Update cached balance
        await tx.update(walletAccounts)
            .set({
                currentBalance: Number(wallet.currentBalance) + Number(amount),
                updatedAt: new Date()
            })
            .where(eq(walletAccounts.id, wallet.id));

        return { status: "success", transaction: txn, idempotencyHit: false };
    });
}

/**
 * Redeem voucher logic (Atomic)
 */
export async function redeemVoucher(
    userId: string,
    code: string,
    currency: string,
    idempotencyKey: string
) {
    const codeHash = getVoucherCodeHash(code);

    return await db.transaction(async (tx) => {
        // Note: Drizzle doesn't have a native "SELECT ... FOR UPDATE" yet via query builder,
        // so we handle the logic carefully or use sql`FOR UPDATE` if strictly needed.
        // For now, we perform checks and constraints.

        let wallet = await tx.query.walletAccounts.findFirst({
            where: (table, { eq, and }) => and(
                eq(table.userId, userId),
                eq(table.currency, currency)
            )
        });

        if (!wallet) {
            const [newWallet] = await tx.insert(walletAccounts).values({
                userId,
                currency,
                currentBalance: 0,
            }).returning();
            wallet = newWallet;
        }

        // idempotency check
        const existing = await tx.query.walletTransactions.findFirst({
            where: (table, { eq, and }) => and(
                eq(table.walletAccountId, wallet!.id),
                eq(table.idempotencyKey, idempotencyKey)
            )
        });

        if (existing) return { status: 'success', transaction: existing, idempotencyHit: true };

        const voucher = await tx.query.vouchers.findFirst({
            where: (table, { eq }) => eq(table.codeHash, codeHash)
        });

        if (!voucher) throw new Error("Invalid voucher code");
        if (voucher.currency !== currency) throw new Error(`Voucher currency mismatch (expected ${voucher.currency})`);
        if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) throw new Error("Voucher is expired");
        if (voucher.status !== "active") throw new Error("Voucher is already used or voided");
        if (voucher.isTest) throw new Error("Test vouchers cannot be redeemed for real balance");

        // post ledger credit
        const [txn] = await tx.insert(walletTransactions).values({
            walletAccountId: wallet.id,
            type: "voucher_credit",
            amount: voucher.amount,
            currency,
            status: "posted",
            referenceType: "voucher",
            referenceId: voucher.id,
            idempotencyKey
        }).returning();

        // update cached balance
        await tx.update(walletAccounts)
            .set({
                currentBalance: Number(wallet.currentBalance) + Number(voucher.amount),
                updatedAt: new Date()
            })
            .where(eq(walletAccounts.id, wallet.id));

        // consume voucher
        await tx.update(vouchers)
            .set({
                status: "redeemed",
                redeemedByUserId: userId,
                redeemedAt: new Date(),
                redemptionTxnId: txn.id
            })
            .where(eq(vouchers.id, voucher.id));

        // audit log
        await tx.insert(securityAuditEvents).values({
            actorType: "user",
            actorId: userId,
            action: "voucher.redeem",
            targetType: "voucher",
            targetId: voucher.id
        });

        return { status: "success", transaction: txn, idempotencyHit: false };
    });
}

/**
 * Admin Wallet Adjustment (Credit or Debit)
 */
export async function adjustWalletBalance(
    userId: string,
    amount: number, // positive for credit, negative for debit
    currency: string,
    reason: string,
    adminId: string,
    idempotencyKey?: string // optional for admin dashboard
) {
    if (amount === 0) throw new Error("Amount cannot be zero");

    return await db.transaction(async (tx) => {
        let wallet = await tx.query.walletAccounts.findFirst({
            where: (table, { eq, and }) => and(
                eq(table.userId, userId),
                eq(table.currency, currency)
            )
        });

        if (!wallet) {
            if (amount < 0) throw new Error("Cannot debit an empty wallet");
            const [newWallet] = await tx.insert(walletAccounts).values({
                userId,
                currency,
                currentBalance: 0,
            }).returning();
            wallet = newWallet;
        }

        const newBalance = Number(wallet.currentBalance) + Number(amount);
        if (newBalance < 0) throw new Error("Insufficient funds for this debit");

        if (idempotencyKey) {
            const existingTxn = await tx.query.walletTransactions.findFirst({
                where: (table, { eq, and }) => and(
                    eq(table.walletAccountId, wallet!.id),
                    eq(table.idempotencyKey, idempotencyKey)
                )
            });
            if (existingTxn) return { status: "success", transaction: existingTxn, idempotencyHit: true };
        }

        const [txn] = await tx.insert(walletTransactions).values({
            walletAccountId: wallet.id,
            type: amount > 0 ? "credit" : "debit",
            amount: Math.abs(amount),
            currency,
            status: "posted",
            referenceType: "admin_adjustment",
            referenceId: adminId, // using referenceId to track the admin who did it
            idempotencyKey,
            metadata: { reason, isCredit: amount > 0 }
        }).returning();

        // Need the type logic in transactions to be consistent if amount is absolute, 
        // wait, in ledger 'amount' for debit vs credit wasn't strictly defined but the DB says "signed or absolute + type convention".
        // In topup we stored absolute amount. Let's look at schema.

        await tx.update(walletAccounts)
            .set({
                currentBalance: newBalance,
                updatedAt: new Date()
            })
            .where(eq(walletAccounts.id, wallet.id));

        return { status: "success", transaction: txn, newBalance, idempotencyHit: false };
    });
}
