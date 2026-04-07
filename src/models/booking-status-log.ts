import {
  pgTable,
  uuid,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { bookings, bookingStatusEnum } from "./booking";
import { users } from "./user";

// ── Audit trail – every status change is logged ────
export const bookingStatusLogs = pgTable(
  "booking_status_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),

    fromStatus: bookingStatusEnum("from_status"),   // null for initial creation

    toStatus: bookingStatusEnum("to_status").notNull(),

    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id),

    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_status_logs_booking_id").on(table.bookingId),
  ]
);

// ── Derived types ──────────────────────────────────
export type BookingStatusLog = InferSelectModel<typeof bookingStatusLogs>;
export type NewBookingStatusLog = InferInsertModel<typeof bookingStatusLogs>;