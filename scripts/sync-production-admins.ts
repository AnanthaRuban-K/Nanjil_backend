import "dotenv/config";
import { and, eq, notInArray } from "drizzle-orm";
import { db, closeConnection, testConnection } from "../src/core/db";
import { hashPassword } from "../src/core/auth";
import { users } from "../src/models/user";

const ADMINS = [
  {
    fullName: "Kannan",
    email: "kannan@nanjilmepservice.com",
    phone: "+918428489046",
  },
  {
    fullName: "Thangarethinam",
    email: "thangarethinam@nanjilmepservice.com",
    phone: "+918428489046",
  },
  {
    fullName: "Vengadesh S",
    email: "vengadeshs@nanjilmepservice.com",
    phone: "+918428489046",
  },
] as const;

function env(name: string) {
  return (process.env[name] || "").trim();
}

async function main() {
  console.log("Syncing production admin users...");
  await testConnection();

  const adminEmails = ADMINS.map((admin) => admin.email);
  const password = env("ADMIN_SYNC_PASSWORD") || env("INITIAL_ADMIN_PASSWORD");

  if (process.env.NODE_ENV === "production" && !password) {
    throw new Error(
      "ADMIN_SYNC_PASSWORD is required in production to create missing admin accounts"
    );
  }

  const hashedPassword = password ? await hashPassword(password) : undefined;

  const deactivated = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(users.role, "ADMIN"), notInArray(users.email, adminEmails)))
    .returning({ email: users.email });

  for (const admin of ADMINS) {
    const existing = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, admin.email))
      .limit(1);

    if (existing[0]) {
      await db
        .update(users)
        .set({
          fullName: admin.fullName,
          phone: admin.phone,
          role: "ADMIN",
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id));

      console.log(`Active admin synced: ${admin.email}`);
      continue;
    }

    if (!hashedPassword) {
      throw new Error(`Cannot create ${admin.email} without ADMIN_SYNC_PASSWORD`);
    }

    await db.insert(users).values({
      fullName: admin.fullName,
      email: admin.email,
      phone: admin.phone,
      hashedPassword,
      role: "ADMIN",
      isActive: true,
    });

    console.log(`Admin created: ${admin.email}`);
  }

  if (deactivated.length > 0) {
    console.log("Deactivated old admin emails:");
    for (const admin of deactivated) {
      console.log(`- ${admin.email}`);
    }
  }

  console.log("Admin sync complete.");
}

main()
  .catch((error) => {
    console.error("Admin sync failed:", error.message);
    process.exit(1);
  })
  .finally(() => closeConnection());
