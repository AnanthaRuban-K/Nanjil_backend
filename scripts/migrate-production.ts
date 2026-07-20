import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeConnection, db } from "../src/core/db";

async function run() {
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
  console.log("Database migrations applied successfully");
}

run()
  .catch((error) => {
    console.error("Database migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(closeConnection);
