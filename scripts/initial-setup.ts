import "dotenv/config";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, closeConnection, testConnection } from "../src/core/db";
import { hashPassword } from "../src/core/auth";
import { users } from "../src/models/user";

type InitialAdmin = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

function value(name: string, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function generatePassword() {
  return `Nanjil-${randomBytes(9).toString("base64url")}@1`;
}

function getInitialAdmin(): InitialAdmin {
  const isProduction = process.env.NODE_ENV === "production";
  const password = value("INITIAL_ADMIN_PASSWORD");

  if (isProduction && !password) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD is required when NODE_ENV=production"
    );
  }

  return {
    fullName: value("INITIAL_ADMIN_FULL_NAME", "Nanjil MEP Admin"),
    email: value("INITIAL_ADMIN_EMAIL", "admin@nanjilmep.local").toLowerCase(),
    phone: value("INITIAL_ADMIN_PHONE", "+918428489046"),
    password: password || generatePassword(),
  };
}

async function createInitialAdmin(admin: InitialAdmin) {
  const existing = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, admin.email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Initial admin already exists: ${admin.email}`);
    console.log(`Existing role: ${existing[0].role}`);
    return { created: false };
  }

  await db.insert(users).values({
    fullName: admin.fullName,
    email: admin.email,
    phone: admin.phone,
    hashedPassword: await hashPassword(admin.password),
    role: "ADMIN",
    isActive: true,
  });

  return { created: true };
}

async function main() {
  console.log("Running Nanjil MEP initial setup...");
  await testConnection();

  const admin = getInitialAdmin();
  const result = await createInitialAdmin(admin);

  if (result.created) {
    console.log("");
    console.log("Initial admin created successfully.");
    console.log(`Login URL: ${value("FRONTEND_URL", "http://localhost:4001")}/login`);
    console.log(`Email: ${admin.email}`);
    console.log(`Password: ${admin.password}`);
    console.log("");
    console.log(
      "Save this password now. It is shown only because this setup script created the account."
    );
  }

  console.log("Initial setup complete.");
}

main()
  .catch((error) => {
    console.error("Initial setup failed:", error.message);
    process.exit(1);
  })
  .finally(() => closeConnection());
