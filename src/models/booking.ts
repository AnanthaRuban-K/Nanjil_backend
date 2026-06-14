import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  timestamp,
  pgEnum,
  index,
  numeric,
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { users } from "./user";

// ── Booking status enum ────────────────────────────
export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];

// ── Payment status enum (NEW — Step 3) ─────────────
export const paymentStatusEnum = pgEnum("payment_status", [
  "UNPAID",
  "PAYMENT_SUBMITTED",
  "PAID",
  "PAYMENT_REJECTED",
]);

export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];

// ── Bookings table ─────────────────────────────────
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    bookingReference: varchar("booking_reference", { length: 20 })
      .unique()
      .notNull(),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id),

    technicianId: uuid("technician_id").references(() => users.id),

    serviceType: varchar("service_type", { length: 100 }).notNull(),

    issueDescription: text("issue_description").notNull(),

    serviceAddress: text("service_address").notNull(),

    preferredDate: date("preferred_date").notNull(),

    scheduledDate: date("scheduled_date"),

    status: bookingStatusEnum("status").notNull().default("PENDING"),

    // ── NEW column ─────────────────────────────────
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("UNPAID"),

    serviceAmount: numeric("service_amount", {
      precision: 10,
      scale: 2,
    }),

    submittedUpiReference: varchar("submitted_upi_reference", { length: 100 }),

    paymentSubmittedAt: timestamp("payment_submitted_at", {
      withTimezone: true,
    }),

    paymentRejectedReason: text("payment_rejected_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_bookings_customer_id").on(table.customerId),
    index("idx_bookings_technician_id").on(table.technicianId),
    index("idx_bookings_status").on(table.status),
    index("idx_bookings_created_at").on(table.createdAt),
  ]
);

// ── Derived types ──────────────────────────────────
export type Booking = InferSelectModel<typeof bookings>;
export type NewBooking = InferInsertModel<typeof bookings>;
