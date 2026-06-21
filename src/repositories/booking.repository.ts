import { eq, desc, count, and, like, inArray, ilike, or, gte, lte } from "drizzle-orm";
import { db } from "../core/db";
import {
  bookings,
  type Booking,
  type NewBooking,
  type BookingStatus,
  type PaymentStatus,
} from "../models/booking";
import {
  bookingStatusLogs,
  type NewBookingStatusLog,
} from "../models/booking-status-log";
import { users } from "../models/user";

// ── Pagination result shape ────────────────────────
export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export interface BookingCustomerContact {
  id: string;
  fullName: string;
  email: string;
  phone: string;
}

export type BookingWithCustomer = Booking & {
  customer: BookingCustomerContact | null;
};

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
  ): Promise<PaginatedResult<BookingWithCustomer>> {
    const offset = (page - 1) * limit;
    const condition = eq(bookings.technicianId, technicianId);

    const [data, totalRows] = await Promise.all([
      db
        .select({
          booking: bookings,
          customer: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
          },
        })
        .from(bookings)
        .leftJoin(users, eq(bookings.customerId, users.id))
        .where(condition)
        .orderBy(desc(bookings.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(bookings)
        .where(condition),
    ]);

    return {
      data: data.map((row) => ({ ...row.booking, customer: row.customer })),
      total: Number(totalRows[0].total),
    };
  }

  async findAll(
    page: number,
    limit: number,
    status?: BookingStatus,
    paymentStatus?: PaymentStatus,
    search?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<PaginatedResult<BookingWithCustomer>> {
    const offset = (page - 1) * limit;
    const conditions = [
      status ? eq(bookings.status, status) : undefined,
      paymentStatus ? eq(bookings.paymentStatus, paymentStatus) : undefined,
      dateFrom ? gte(bookings.preferredDate, dateFrom) : undefined,
      dateTo ? lte(bookings.preferredDate, dateTo) : undefined,
      search
        ? or(
            ilike(bookings.bookingReference, `%${search}%`),
            ilike(bookings.serviceType, `%${search}%`),
            ilike(bookings.serviceAddress, `%${search}%`),
            ilike(users.fullName, `%${search}%`),
            ilike(users.email, `%${search}%`),
            ilike(users.phone, `%${search}%`)
          )
        : undefined,
    ].filter(Boolean);
    const condition = conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = () => {
      const query = db
        .select({
          booking: bookings,
          customer: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
          },
        })
        .from(bookings)
        .leftJoin(users, eq(bookings.customerId, users.id));
      return condition ? query.where(condition) : query;
    };

    const countQuery = () => {
      const query = db
        .select({ total: count() })
        .from(bookings)
        .leftJoin(users, eq(bookings.customerId, users.id));
      return condition ? query.where(condition) : query;
    };

    const [data, totalRows] = await Promise.all([
      baseQuery().orderBy(desc(bookings.createdAt)).limit(limit).offset(offset),
      countQuery(),
    ]);

    return {
      data: data.map((row) => ({ ...row.booking, customer: row.customer })),
      total: Number(totalRows[0].total),
    };
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
  async submitUpiPayment(
    id: string,
    customerId: string,
    upiReference: string
  ): Promise<Booking | undefined> {
    const rows = await db
      .update(bookings)
      .set({
        paymentStatus: "PAYMENT_SUBMITTED",
        submittedUpiReference: upiReference,
        paymentSubmittedAt: new Date(),
        paymentRejectedReason: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.id, id),
          eq(bookings.customerId, customerId),
          eq(bookings.status, "COMPLETED"),
          inArray(bookings.paymentStatus, ["UNPAID", "PAYMENT_REJECTED"])
        )
      )
      .returning();

    return rows[0];
  }

  async rejectPaymentSubmission(
    id: string,
    reason: string | null
  ): Promise<Booking | undefined> {
    const rows = await db
      .update(bookings)
      .set({
        paymentStatus: "PAYMENT_REJECTED",
        paymentRejectedReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.id, id),
          eq(bookings.paymentStatus, "PAYMENT_SUBMITTED")
        )
      )
      .returning();

    return rows[0];
  }

  async updateServiceAmount(
    id: string,
    amount: string
  ): Promise<Booking | undefined> {
    const rows = await db
      .update(bookings)
      .set({
        serviceAmount: amount,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning();

    return rows[0];
  }

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
