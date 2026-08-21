import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";
import * as authSchema from "@/lib/db/auth-schema";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const db = drizzle<typeof schema & typeof authSchema>({
    schema: { ...schema, ...authSchema },
    client: pool
});