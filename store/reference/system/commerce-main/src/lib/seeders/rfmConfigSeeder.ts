import { BaseSeeder } from "./baseSeeder";
import { db } from "@/lib/db/drizzle";
import { analyticsRfmConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export class RfmConfigSeeder implements BaseSeeder {
  name = "RfmConfigSeeder";
  priority = 60;

  async checkIfDataExists(): Promise<boolean> {
    const existing = await db.query.analyticsRfmConfigs.findFirst({
      where: eq(analyticsRfmConfigs.isActive, true),
    });
    return Boolean(existing);
  }

  async seed(): Promise<void> {
    const now = new Date();
    await db.insert(analyticsRfmConfigs).values({
      name: "الإعداد الافتراضي",
      description: "تكوين افتراضي لـ RFM مع نوافذ 30/90 يوماً",
      isActive: true,
      recencyWindowDays: 30,
      frequencyWindowDays: 90,
      monetaryWindowDays: 90,
      recencyScale: [
        { min: 0, max: 7, score: 5 },
        { min: 8, max: 14, score: 4 },
        { min: 15, max: 30, score: 3 },
        { min: 31, max: 60, score: 2 },
        { min: 61, score: 1 },
      ],
      frequencyScale: [
        { min: 0, max: 1, score: 1 },
        { min: 2, max: 3, score: 2 },
        { min: 4, max: 5, score: 3 },
        { min: 6, max: 9, score: 4 },
        { min: 10, score: 5 },
      ],
      monetaryScale: [
        { min: 0, max: 100, score: 1 },
        { min: 100, max: 300, score: 2 },
        { min: 300, max: 800, score: 3 },
        { min: 800, max: 1500, score: 4 },
        { min: 1500, score: 5 },
      ],
      weights: { recency: 0.4, frequency: 0.3, monetary: 0.3 },
      dimensions: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}
