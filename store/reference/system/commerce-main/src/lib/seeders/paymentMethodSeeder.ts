import { db } from "@/lib/db/drizzle";
import { paymentMethodConfigurations } from "@/lib/db/schema";
import { PaymentService } from "@/modules/payments/services/paymentService";
import { eq, or } from "drizzle-orm";
import { BaseSeeder } from "./baseSeeder";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";

export class PaymentMethodSeeder implements BaseSeeder {
  name = "PaymentMethodSeeder";
  priority = 10; // Adjust priority as needed

  async checkIfDataExists(): Promise<boolean> {
    try {
      const existingMethods = await db.query.paymentMethodConfigurations.findMany({
        where: or(
          eq(paymentMethodConfigurations.methodCode, PaymentMethodCode.BINANCE_PAY),
          eq(paymentMethodConfigurations.methodCode, PaymentMethodCode.MANUAL_PAYMENT),
          eq(paymentMethodConfigurations.methodCode, PaymentMethodCode.SADAD_PAY),
          eq(paymentMethodConfigurations.methodCode, PaymentMethodCode.MOAMALAT),
          eq(paymentMethodConfigurations.methodCode, PaymentMethodCode.PLUTU)
        ),
        limit: 1,
      });
      return existingMethods.length > 0;
    } catch (error) {
      console.error("Error checking for existing payment methods:", error);
      return false; // Assume data doesn't exist if check fails
    }
  }

  async seed(): Promise<void> {
    try {
      console.log("Running PaymentMethodSeeder...");
      await PaymentService.seedPaymentMethodConfigurations();
      console.log("PaymentMethodSeeder completed.");
    } catch (error) {
      console.error("Error seeding payment methods:", error);
      throw error;
    }
  }
}
