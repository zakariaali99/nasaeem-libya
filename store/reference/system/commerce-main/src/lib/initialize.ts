import { dataSeeder } from "@/lib/seeders/dataSeeder";

/**
 * Initialize the application by running necessary database seeding
 * This ensures required data exists before the application starts
 */
export async function initializeApp() {
  try {
    console.log("🌱 Running initial data seeders...");
    await dataSeeder.seedOnStartup();
    console.log("✅ Application initialization complete");
  } catch (error) {
    console.error("❌ Error during application initialization:", error);
    // In production, you might want to throw here to prevent app startup with missing data
    // throw error;
  }
}