import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// ── Role enum (stored inside PostgreSQL) ───────────
export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "TECHNICIAN",
  "CUSTOMER",
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];

// ── Users table ────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: varchar("full_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    phone: varchar("phone", { length: 15 }).notNull(),
    hashedPassword: text("hashed_password").notNull(),
    role: userRoleEnum("role").notNull().default("CUSTOMER"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_role").on(table.role),
  ]
);

// ── Derived TypeScript types ───────────────────────
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type SafeUser = Omit<User, "hashedPassword">;