import "dotenv/config";
import { db, closeConnection } from "../src/core/db";
import { users } from "../src/models/user";
import { hashPassword } from "../src/core/auth";
import { eq } from "drizzle-orm";

// ── 6 Technician users ─────────────────────────────
const TECHNICIANS = [
  {
    fullName: "Ravi Kumar",
    email: "tech1@nanjilmep.com",
    phone: "9810000001",
  },
  {
    fullName: "Suresh Babu",
    email: "tech2@nanjilmep.com",
    phone: "9810000002",
  },
  {
    fullName: "Mohan Raj",
    email: "tech3@nanjilmep.com",
    phone: "9810000003",
  },
  {
    fullName: "Karthik Vel",
    email: "tech4@nanjilmep.com",
    phone: "9810000004",
  },
  {
    fullName: "Dinesh Pandian",
    email: "tech5@nanjilmep.com",
    phone: "9810000005",
  },
  {
    fullName: "Arun Prakash",
    email: "tech6@nanjilmep.com",
    phone: "9810000006",
  },
];

// ⚠️  Change this immediately after first login
const DEFAULT_PASSWORD = "NanjilTech@2024";

async function seed() {
  console.log("🌱  Seeding technician users …\n");

  const hashed = await hashPassword(DEFAULT_PASSWORD);
  let created = 0;
  let skipped = 0;

  for (const tech of TECHNICIANS) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, tech.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭  ${tech.email} already exists — skipped`);
      skipped++;
      continue;
    }

    await db.insert(users).values({
      fullName: tech.fullName,
      email: tech.email,
      phone: tech.phone,
      hashedPassword: hashed,
      role: "TECHNICIAN",
    });

    console.log(`  ✅  ${tech.email} created`);
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