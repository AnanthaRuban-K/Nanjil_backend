import { readFile } from "fs/promises";
import { resolve } from "path";
import { Pool } from "pg";
import { config } from "../src/core/config";

async function main() {
  const migrationPath = resolve(
    process.cwd(),
    "migrations/manual/20260614_upi_payment_flow_existing_db.sql"
  );
  const sql = await readFile(migrationPath, "utf8");
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    console.log("Applying existing DB UPI payment-flow migration...");
    await pool.query(sql);
    console.log("Migration applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
