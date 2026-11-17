// Applies supabase/migrations/*.sql using SUPABASE_DB_URL. Safe to re-run.
import { config } from "dotenv";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      "SUPABASE_DB_URL is not set in .env.local.\n" +
        "Either add it (Supabase -> Project Settings -> Database -> Connection string -> URI)\n" +
        "or paste the files in supabase/migrations into the Supabase SQL editor in order."
    );
    process.exit(1);
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    process.stdout.write(`Applying ${file} ... `);
    try {
      await client.query(readFileSync(join(dir, file), "utf8"));
      console.log("ok");
    } catch (e: any) {
      if (file.includes("cron")) {
        console.log("skipped");
        console.warn(`  pg_cron is optional and could not be set up: ${e.message}`);
      } else {
        console.log("FAILED");
        console.error(e.message);
        await client.end();
        process.exit(1);
      }
    }
  }
  // Make PostgREST pick up the new tables immediately.
  await client.query("notify pgrst, 'reload schema'").catch(() => {});
  await client.end();
  console.log("Database is ready. Next: npm run seed");
}

main();
