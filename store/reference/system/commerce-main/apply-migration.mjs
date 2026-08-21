import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

async function migrate() {
    console.log("Starting manual migration...");
    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/commerce'
    });

    try {
        await client.connect();

        const sqlPath = '/Users/hatem/Develop/commerce/migrations/new_dev/0006_awesome_santa_claus.sql';
        const fileContent = fs.readFileSync(sqlPath, 'utf8');

        // Split on statement-breakpoint since it's drizzle's custom separator
        const statements = fileContent.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

        for (const statement of statements) {
            console.log(`Executing: ${statement}`);
            await client.query(statement);
            console.log("Success.");
        }

        console.log("Migration complete.");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

migrate();
