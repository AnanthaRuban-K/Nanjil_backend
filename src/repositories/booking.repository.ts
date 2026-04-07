import { eq, desc, count, and, like } from "drizzle-orm";
import { db } from "../core/db";
import {
  bookings,
  type Booking,
  type NewBooking,
  type BookingStatus,
} from "../models/booking";
import {
  bookingStatusLogs,
  type NewBookingStatusLog,
} from "../models/booking-status-log";

// ── Pagination result shape ────────────────────────
export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export class BookingRepository {
  // ────────────────────────────────────────────────
  // Reference generator  –  NMS-YYYY-00001
  // ────────────────────────────────────────────────
  async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `NMS-${year}-`;

    const result = await db
      .select({ ref: bookings.bookingReference })
      .from(bookings)
      .where(like(bookings.bookingReference, `${prefix}%`))
      .orderBy(desc(bookings.bookingReference))
      .limit(1);

    let nextNum = 1;

    if (result.length > 0) {
      const parts = result[0].ref.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }

    return `${prefix}${nextNum.toString().padStart(5, "0")}`;
  }

  // ────────────────────────────────────────────────
  // Create booking + initial audit log (transaction)
  // ────────────────────────────────────────────────
  async createWithLog(
    data: NewBooking,
    changedBy: string
  ): Promise<Booking> {
    return db.transaction(async (tx) => {
      const rows = await tx.insert(bookings).values(data).returning();
      const booking = rows[0];

      await tx.insert(bookingStatusLogs).values({
        bookingId: booking.id,
        fromStatus: null,
        toStatus: "PENDING",
        changedBy,
      });

      return booking;
    });
  }

  // ────────────────────────────────────────────────
  // Read helpers
  // ────────────────────────────────────────────────
  async findById(id: string): Promise<Booking | undefined> {
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);
    return rows[0];
  }

  async findByCustomerId(
    customerId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<Booking>> {
    const offset = (page - 1) * limit;
    const condition = eq(bookings.customerId, customerId);

    const [data, totalRows] = await Promise.all([
      db
        .select()
        .from(bookings)
        .where(condition)
        .orderBy(desc(bookings.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(bookings)
        .where(condition),
    ]);

    return { data, total: Number(totalRows[0].total) };
  }

  async findByTechnicianId(
    technicianId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<Booking>> {
    const offset = (page - 1) * limit;
    const condition = eq(bookings.technicianId, technicianId);

    const [data, totalRows] = await Promise.all([
      db
        .select()
        .from(bookings)
        .where(condition)
        .orderBy(desc(bookings.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(bookings)
        .where(condition),
    ]);

    return { data, total: Number(totalRows[0].total) };
  }

  async findAll(
    page: number,
    limit: number,
    status?: BookingStatus
  ): Promise<PaginatedResult<Booking>> {
    const offset = (page - 1) * limit;
    const condition = status ? eq(bookings.status, status) : undefined;

    const baseQuery = () =>
      condition
        ? db.select().from(bookings).where(condition)
        : db.select().from(bookings);

    const countQuery = () =>
      condition
        ? db.select({ total: count() }).from(bookings).where(condition)
        : db.select({ total: count() }).from(bookings);

    const [data, totalRows] = await Promise.all([
      baseQuery().orderBy(desc(bookings.createdAt)).limit(limit).offset(offset),
      countQuery(),
    ]);

    return { data, total: Number(totalRows[0].total) };
  }

  // ────────────────────────────────────────────────
  // Status update + audit log  (transaction)
  // Uses optimistic WHERE on current status
  // ────────────────────────────────────────────────
  async updateStatusWithLog(
    id: string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
    changedBy: string
  ): Promise<Booking | undefined> {
    return db.transaction(async (tx) => {
      const rows = await tx
        .update(bookings)
        .set({ status: toStatus, updatedAt: new Date() })
        .where(and(eq(bookings.id, id), eq(bookings.status, fromStatus)))
        .returning();

      if (rows.length === 0) return undefined;

      await tx.insert(bookingStatusLogs).values({
        bookingId: id,
        fromStatus,
        toStatus,
        changedBy,
      });

      return rows[0];
    });
  }

  // ────────────────────────────────────────────────
  // Assign technician + move PENDING → CONFIRMED
  // ────────────────────────────────────────────────
  async assignTechnicianWithLog(
    id: string,
    technicianId: string,
    changedBy: string,
    scheduledDate?: string
  ): Promise<Booking | undefined> {
    return db.transaction(async (tx) => {
      const rows = await tx
        .update(bookings)
        .set({
          technicianId,
          status: "CONFIRMED" as const,
          updatedAt: new Date(),
          ...(scheduledDate ? { scheduledDate } : {}),
        })
        .where(and(eq(bookings.id, id), eq(bookings.status, "PENDING")))
        .returning();

      if (rows.length === 0) return undefined;

      await tx.insert(bookingStatusLogs).values({
        bookingId: id,
        fromStatus: "PENDING",
        toStatus: "CONFIRMED",
        changedBy,
      });

      return rows[0];
    });
  }

  // ────────────────────────────────────────────────
  // Fetch audit trail for a booking
  // ────────────────────────────────────────────────
  async getStatusLogs(bookingId: string): Promise<NewBookingStatusLog[]> {
    return db
      .select()
      .from(bookingStatusLogs)
      .where(eq(bookingStatusLogs.bookingId, bookingId))
      .orderBy(desc(bookingStatusLogs.changedAt));
  }
}

// ── Singleton ──────────────────────────────────────
export const bookingRepository = new BookingRepository();