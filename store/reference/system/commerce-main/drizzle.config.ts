import { defineConfig } from "drizzle-kit";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
    schema: ["./src/lib/db/schema.ts", "./src/lib/db/auth-schema.ts"],
    out: isProd ? "./migrations/prod" : "./migrations/new_dev",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});