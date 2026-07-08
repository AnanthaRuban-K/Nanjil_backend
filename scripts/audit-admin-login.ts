import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { comparePassword } from "../src/core/auth";
import { db, closeConnection, testConnection } from "../src/core/db";
import { users } from "../src/models/user";

const ADMIN_EMAILS = [
  "kannan@nanjilmepservice.com",
  "thangarethinam@nanjilmepservice.com",
  "vengadeshs@nanjilmepservice.com",
] as const;

function env(name: string) {
  return (process.env[name] || "").trim();
}

async function main() {
  console.log("Auditing admin login accounts...");
  await testConnection();

  const password = env("ADMIN_LOGIN_TEST_PASSWORD") || env("ADMIN_SYNC_PASSWORD") || env("INITIAL_ADMIN_PASSWORD");

  if (!password) {
    throw new Error(
      "Set ADMIN_LOGIN_TEST_PASSWORD, ADMIN_SYNC_PASSWORD, or INITIAL_ADMIN_PASSWORD to test password matching"
    );
  }

  const rows = await db
    .select({
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      hashedPassword: users.hashedPassword,
    })
    .from(users)
    .where(inArray(users.email, [...ADMIN_EMAILS]));

  for (const email of ADMIN_EMAILS) {
    const user = rows.find((row) => row.email === email);

    if (!user) {
      console.log(`${email}: NOT FOUND`);
      continue;
    }

    const passwordMatches = await comparePassword(password, user.hashedPassword);
    console.log(
      `${email}: role=${user.role}, active=${user.isActive}, passwordMatches=${passwordMatches}`
    );
  }

  const activeAdmins = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "ADMIN"));

  console.log("");
  console.log("Admin emails in database:");
  for (const admin of activeAdmins) {
    console.log(`- ${admin.email}`);
  }
}

main()
  .catch((error) => {
    console.error("Admin login audit failed:", error.message);
    process.exit(1);
  })
  .finally(() => closeConnection());
