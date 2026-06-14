import "dotenv/config";
import { db, closeConnection } from "../src/core/db";
import { users } from "../src/models/user";
import { hashPassword } from "../src/core/auth";
import { eq } from "drizzle-orm";

// ── 3 Admin users ──────────────────────────────────
const ADMINS = [
  {
    fullName: "Admin One",
    email: "admin1@nanjilmep.com",
    phone: "+918428489046",
  },
  {
    fullName: "Admin Two",
    email: "admin2@nanjilmep.com",
    phone: "9800000002",
  },
  {
    fullName: "Admin Three",
    email: "admin3@nanjilmep.com",
    phone: "9800000003",
  },
];

// ⚠️  Change this immediately after first login
const DEFAULT_PASSWORD = "NanjilAdmin@2024";

async function seed() {
  console.log("🌱  Seeding admin users …\n");

  const hashed = await hashPassword(DEFAULT_PASSWORD);
  let created = 0;
  let skipped = 0;

  for (const admin of ADMINS) {
    // check existence
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, admin.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭  ${admin.email} already exists — skipped`);
      skipped++;
      continue;
    }

    await db.insert(users).values({
      fullName: admin.fullName,
      email: admin.email,
      phone: admin.phone,
      hashedPassword: hashed,
      role: "ADMIN",
    });

    console.log(`  ✅  ${admin.email} created`);
    created++;
  }

  console.log(`\n🏁  Done — ${created} created, ${skipped} skipped`);
}

seed()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeConnection());
