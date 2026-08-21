import { NextRequest, NextResponse } from "next/server";
import { PaymentService, registeredPaymentMethods } from "../services/paymentService";
import { db } from "@/lib/db/drizzle";
import { paymentMethodConfigurations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PaymentMethodCode, PaymentStatus } from "../types/paymentTypes";
import { validateRequest } from "@/lib/api-protection";
import { ROLES, PERMISSIONS } from "@/lib/rbac";
import { z } from "zod";

const paymentService = new PaymentService();

export class PaymentsController {
  // Get all payment methods (public - excludes sensitive data)
  static async getPublicPaymentMethods() {
    try {
      const methods = await paymentService.getAvailablePaymentMethods();
      return NextResponse.json(methods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      return NextResponse.json(
        { error: "حدث خطأ في جلب طرق الدفع المتاحة" },
        { status: 500 }
      );
    }
  }

  // Admin: Get all payment methods including configuration
  static async getAdminPaymentMethods(req: NextRequest) {
    try {
      const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
      if (!authResult.success) {
        return authResult.response;
      }

      const methods = await db.query.paymentMethodConfigurations.findMany({
        orderBy: paymentMethodConfigurations.sortOrder,
      });

      return NextResponse.json(methods);
    } catch (error) {
      console.error("Error fetching admin payment methods:", error);
      return NextResponse.json(
        { error: "حدث خطأ في جلب بيانات طرق الدفع" },
        { status: 500 }
      );
    }
  }

  // Admin: Update payment method configuration
  static async updatePaymentMethod(request: NextRequest, methodCode: string) {
    try {
      const authResult = await validateRequest(request, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
      if (!authResult.success) {
        return authResult.response;
      }

      const paymentMethodSchema = z.object({
        displayName: z.string().min(1, "اسم طريقة الدفع مطلوب"),
        description: z.string().nullable().optional(),
        configData: z.record(z.any()),
        isEnabled: z.boolean(),
        sortOrder: z.number().nullable().optional(),
      });

      const data = await request.json();
      const validatedData = paymentMethodSchema.parse(data);

      const existing = await db.query.paymentMethodConfigurations.findFirst({
        where: eq(
          paymentMethodConfigurations.methodCode,
          methodCode as PaymentMethodCode
        ),
      });

      if (existing) {
        // Update existing payment method configuration
        const updated = await db
          .update(paymentMethodConfigurations)
          .set({
            displayName: validatedData.displayName,
            description: validatedData.description,
            configData: validatedData.configData,
            isEnabled: validatedData.isEnabled,
            sortOrder: validatedData.sortOrder,
            updatedAt: new Date(),
          })
          .where(
            eq(
              paymentMethodConfigurations.methodCode,
              methodCode as PaymentMethodCode
            )
          )
          .returning();

        // Re-initialize payment methods if the enabled status changed
        if (validatedData.isEnabled !== existing.isEnabled) {
          await paymentService.getAvailablePaymentMethods();
        }

        return NextResponse.json(updated[0]);
      } else {
        // Create new payment method configuration
        const newMethod = await db
          .insert(paymentMethodConfigurations)
          .values({
            methodCode: methodCode as PaymentMethodCode,
            displayName: validatedData.displayName,
            description: validatedData.description,
            configData: validatedData.configData,
            isEnabled: validatedData.isEnabled,
            sortOrder: validatedData.sortOrder,
          })
          .returning();

        // Re-initialize payment methods if the new method is enabled
        if (validatedData.isEnabled) {
          await paymentService.getAvailablePaymentMethods();
        }

        return NextResponse.json(newMethod[0], { status: 201 });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "بيانات غير صالحة", details: error.format() },
          { status: 400 }
        );
      }

      console.error("Error updating payment method:", error);
      return NextResponse.json(
        { error: "حدث خطأ في تحديث طريقة الدفع" },
        { status: 500 }
      );
    }
  }

  // Admin: Get single payment method configuration
  static async getPaymentMethod(req: NextRequest, methodCode: string) {
    try {
      const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
      if (!authResult.success) {
        return authResult.response;
      }

      const method = await db.query.paymentMethodConfigurations.findFirst({
        where: eq(
          paymentMethodConfigurations.methodCode,
          methodCode as PaymentMethodCode
        ),
      });

      if (!method) {
        return NextResponse.json(
          { error: "طريقة الدفع غير موجودة" },
          { status: 404 }
        );
      }

      return NextResponse.json(method);
    } catch (error) {
      console.error("Error fetching payment method:", error);
      return NextResponse.json(
        { error: "حدث خطأ في جلب بيانات طريقة الدفع" },
        { status: 500 }
      );
    }
  }

  // Admin: Delete payment method configuration
  static async deletePaymentMethod(req: NextRequest, methodCode: string) {
    try {
      const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
      if (!authResult.success) {
        return authResult.response;
      }
      const existing = await db.query.paymentMethodConfigurations.findFirst({
        where: eq(
          paymentMethodConfigurations.methodCode,
          methodCode as PaymentMethodCode
        ),
      });
      if (!existing) {
        return NextResponse.json(
          { error: "طريقة الدفع غير موجودة" },
          { status: 404 }
        );
      }
      await db
        .delete(paymentMethodConfigurations)
        .where(
          eq(
            paymentMethodConfigurations.methodCode,
            methodCode as PaymentMethodCode
          )
        );
      // Remove from in-memory registry if present
      registeredPaymentMethods.delete(methodCode as PaymentMethodCode);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting payment method:", error);
      return NextResponse.json(
        { error: "حدث خطأ في حذف طريقة الدفع" },
        { status: 500 }
      );
    }
  }

  // Admin: List payments with pagination, search, filtering, sorting
  static async listPayments(req: NextRequest) {
    try {
      const authResult = await validateRequest(req, [...PERMISSIONS.VIEW_FINANCE]);
      if (!authResult.success) {
        return authResult.response;
      }
      const url = new URL(req.url);
      const params = {
        page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!, 10) : undefined,
        perPage: url.searchParams.get('perPage') ? parseInt(url.searchParams.get('perPage')!, 10) : undefined,
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') as PaymentStatus || undefined,
        methodCode: url.searchParams.get('methodCode') as PaymentMethodCode || undefined,
        sortBy: url.searchParams.get('sortBy') || undefined,
        sortOrder: (url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
      };
      const result = await paymentService.listPayments(params);
      return NextResponse.json(result);
    } catch (error) {
      console.error('Error listing payments:', error);
      return NextResponse.json({ error: 'حدث خطأ في جلب سجلات الدفع' }, { status: 500 });
    }
  }
}