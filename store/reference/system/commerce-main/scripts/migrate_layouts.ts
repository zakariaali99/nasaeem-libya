import "dotenv/config";
import { db } from "../src/lib/db/drizzle";
import { storefrontLayouts, widgets } from "../src/lib/db/schema";
import { eq, isNull } from "drizzle-orm";

async function main() {
  const layouts = await db.select().from(storefrontLayouts).where(eq(storefrontLayouts.isGlobalActive, true));
  if (layouts.length === 0) {
    const newLayout = await db.insert(storefrontLayouts).values({
      name: "التخطيط الافتراضي",
      isGlobalActive: true,
    }).returning();
    const layoutId = newLayout[0].id;
    console.log(`Created default layout: ${layoutId}`);

    await db.update(widgets).set({ layoutId }).where(isNull(widgets.layoutId));
    console.log("Updated widgets.");
  } else {
    console.log("Global active layout already exists.");
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
