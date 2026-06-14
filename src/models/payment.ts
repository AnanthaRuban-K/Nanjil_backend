import {
  pgTable,
  uuid,
  numeric,
  varchar,
  date,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { bookings } from "./booking";
import { users } from "./user";

// ── Payment mode enum ──────────────────────────────
export const paymentModeEnum = pgEnum("payment_mode", ["CASH", "UPI"]);

export type PaymentMode = (typeof paymentModeEnum.enumValues)[number];

// ── Payments table ─────────────────────────────────
// One booking → one payment (unique on booking_id)
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id)
      .unique(),

    invoiceNumber: varchar("invoice_number", { length: 30 })
      .notNull()
      .unique(),

    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),

    paymentMode: paymentModeEnum("payment_mode").notNull(),

    upiReference: varchar("upi_reference", { length: 100 }),

    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),

    paymentDate: date("payment_date").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_payments_booking_id").on(table.bookingId),
    index("idx_payments_payment_date").on(table.paymentDate),
    index("idx_payments_payment_mode").on(table.paymentMode),
  ]
);

// ── Derived types ──────────────────────────────────
export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;
