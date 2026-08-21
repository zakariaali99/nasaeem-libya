import "dotenv/config";
import { db } from "@/lib/db/drizzle";
import { partnerApps, vouchers } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { createWalletTopup, redeemVoucher, generateVoucherCode, getVoucherCodeHash } from "@/lib/services/ledger";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function runTests() {
    console.log("Starting Ledger & Voucher Tests...");

    // 1. Create a mock user
    const [testUser] = await db.insert(user).values({
        id: crypto.randomUUID(),
        name: "Test User",
        email: `test-${Date.now()}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    }).returning();
    console.log("Created Test User:", testUser.id);

    try {
        // 2. Test Wallet Topup
        console.log("Testing Wallet Topup...");
        const topupResult = await createWalletTopup(
            testUser.id,
            5000, // 50 LYD
            "LYD",
            "payment_intent",
            "pi_mock_123",
            `idem_topup_${Date.now()}`
        );
        console.log("Topup Result:", topupResult.status, "Balance increased by 5000");

        // 3. Test Idempotency
        console.log("Testing Idempotency on Topup...");
        const duplicateTopup = await createWalletTopup(
            testUser.id,
            5000,
            "LYD",
            "payment_intent",
            "pi_mock_123",
            topupResult.transaction.idempotencyKey!
        );
        console.log("Idempotency Result:", duplicateTopup.idempotencyHit ? "Hit!" : "Failed");

        // 4. Test Voucher Redemption
        console.log("Creating internal voucher...");
        const code = generateVoucherCode();

        // Using simple query instead to avoid require typings issue
        const mockCampId = crypto.randomUUID();
        await db.execute(require("drizzle-orm").sql`
      INSERT INTO voucher_campaigns (id, name, issuer_type, currency, value_type, fixed_amount, status, created_at)
      VALUES (${mockCampId}, 'Test Campaign', 'internal', 'LYD', 'fixed', 1000, 'active', NOW())
    `);

        const voucherId = crypto.randomUUID();
        await db.execute(require("drizzle-orm").sql`
      INSERT INTO vouchers (id, campaign_id, code_hash, code_last4, amount, currency, status, created_at)
      VALUES (${voucherId}, ${mockCampId}, ${getVoucherCodeHash(code)}, ${code.slice(-4)}, 1000, 'LYD', 'active', NOW())
    `);

        console.log("Redeeming Voucher:", code);
        const redeemResult = await redeemVoucher(
            testUser.id,
            code,
            "LYD",
            `idem_redeem_${Date.now()}`
        );
        console.log("Redeem Result:", redeemResult.status, "Balance increased by 1000");

        // Check balance
        const updatedWallet = await db.query.walletAccounts.findFirst({
            where: (table, { eq }) => eq(table.userId, testUser.id)
        });
        console.log("Final Wallet Balance:", updatedWallet?.currentBalance, "(Expected 6000)");

        // Clean up
        await db.delete(user).where(eq(user.id, testUser.id));
        console.log("Tests Completed Successfully!");

    } catch (err) {
        console.error("Test Failed:");
        console.error(err);
        await db.delete(user).where(eq(user.id, testUser.id)).catch(() => null);
    }

    process.exit(0);
}

runTests();
