import { BaseSeeder } from "./baseSeeder";
import { db } from "@/lib/db/drizzle";
import { categories } from "@/lib/db/schema";
import { count, inArray } from "drizzle-orm";

export class SystemCategoriesSeeder implements BaseSeeder {
  name = "SystemCategoriesSeeder";
  priority = 50;

  async checkIfDataExists(): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(categories)
      .where(
        inArray(categories.slug, [
          "top-selling",
          "recently-added",
          "hot",
        ])
      );
    return result[0].count === 3;
  }

  async seed(): Promise<void> {
    const now = new Date();
    await db.insert(categories).values([
      {
        name: "الأكثر مبيعًا",
        slug: "top-selling",
        description: null,
        imageUrl: null,
        parentId: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "الجديدة مؤخرًا",
        slug: "recently-added",
        description: null,
        imageUrl: null,
        parentId: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "الشائع",
        slug: "hot",
        description: null,
        imageUrl: null,
        parentId: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }
}
