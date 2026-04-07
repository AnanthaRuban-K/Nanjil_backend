import { sql, eq, and, between, desc } from "drizzle-orm";
import { db } from "../core/db";
import { bookings } from "../models/booking";
import { payments } from "../models/payment";
import { users } from "../models/user";
import { bookingStatusLogs } from "../models/booking-status-log";

// ── Result shapes ──────────────────────────────────
export interface DashboardSummary {
  totalBookings: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  completedToday: number;
  unpaidCompleted: number;
  totalRevenueCollected: number;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  cashTotal: number;
  upiTotal: number;
  totalPaidBookings: number;
}

export interface TechnicianStat {
  technicianName: string;
  completedJobs: number;
}

export interface BookingAnalytics {
  byStatus: {
    PENDING: number;
    CONFIRMED: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  byTechnician: TechnicianStat[];
}

// ── Repository ─────────────────────────────────────
export class AnalyticsRepository {
  // ────────────────────────────────────────────────
  // Dashboard summary  (3 fast indexed queries)
  // ────────────────────────────────────────────────
  async getDashboardSummary(): Promise<DashboardSummary> {
    // Query 1 — status counts + unpaid-completed
    const [counts] = await db
      .select({
        totalBookings: sql<number>`COUNT(*)::int`,
        pending: sql<number>`
          COUNT(*) FILTER (WHERE ${bookings.status} = 'PENDING')::int`,
        confirmed: sql<number>`
          COUNT(*) FILTER (WHERE ${bookings.status} = 'CONFIRMED')::int`,
        inProgress: sql<number>`
          COUNT(*) FILTER (WHERE ${bookings.status} = 'IN_PROGRESS')::int`,
        unpaidCompleted: sql<number>`
          COUNT(*) FILTER (
            WHERE ${bookings.status} = 'COMPLETED'
              AND ${bookings.paymentStatus} = 'UNPAID'
          )::int`,
      })
      .from(bookings);

    // Query 2 — completed today (from audit trail)
    const [today] = await db
      .select({
        count: sql<number>`
          COUNT(DISTINCT ${bookingStatusLogs.bookingId})::int`,
      })
      .from(bookingStatusLogs)
      .where(
        and(
          eq(bookingStatusLogs.toStatus, "COMPLETED"),
          sql`${bookingStatusLogs.changedAt}::date = CURRENT_DATE`
        )
      );

    // Query 3 — lifetime revenue
    const [rev] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments);

    return {
      totalBookings: counts.totalBookings,
      pending: counts.pending,
      confirmed: counts.confirmed,
      inProgress: counts.inProgress,
      completedToday: today.count,
      unpaidCompleted: counts.unpaidCompleted,
      totalRevenueCollected: parseFloat(rev.total),
    };
  }

  // ────────────────────────────────────────────────
  // Revenue analytics  (single query with date range)
  // ────────────────────────────────────────────────
  async getRevenueAnalytics(
    dateFrom: string,
    dateTo: string
  ): Promise<RevenueAnalytics> {
    const [row] = await db
      .select({
        totalRevenue: sql<string>`
          COALESCE(SUM(${payments.amount}), 0)`,
        cashTotal: sql<string>`
          COALESCE(
            SUM(CASE WHEN ${payments.paymentMode} = 'CASH'
                     THEN ${payments.amount} ELSE 0 END
            ), 0
          )`,
        upiTotal: sql<string>`
          COALESCE(
            SUM(CASE WHEN ${payments.paymentMode} = 'UPI'
                     THEN ${payments.amount} ELSE 0 END
            ), 0
          )`,
        totalPaidBookings: sql<number>`COUNT(*)::int`,
      })
      .from(payments)
      .where(between(payments.paymentDate, dateFrom, dateTo));

    return {
      totalRevenue: parseFloat(row.totalRevenue),
      cashTotal: parseFloat(row.cashTotal),
      upiTotal: parseFloat(row.upiTotal),
      totalPaidBookings: row.totalPaidBookings,
    };
  }

  // ────────────────────────────────────────────────
  // Booking analytics  (2 queries)
  // ────────────────────────────────────────────────
  async getBookingAnalytics(): Promise<BookingAnalytics> {
    // Query 1 — breakdown by status
    const [statusRow] = await db
      .select({
        pending: sql<number>`
          COUNT(*) FILTER (WHERE ${bookings.status} = 'PENDING')::int`,
        confirmed: sql<number>`
          COUNT(*) FILTER (WHERE ${bookings.status} = 'CONFIRMED')::int`,
        inProgress: sql<number>`
          COUNT(*) FILTER (WHERE ${bookings.status} = 'IN_PROGRESS')::int`,
        completed: sql<number>`
          COUNT(*) FILTER (WHERE ${bookings.status} = 'COMPLETED')::int`,
        cancelled: sql<number>`
          COUNT(*) FILTER (WHERE ${bookings.status} = 'CANCELLED')::int`,
      })
      .from(bookings);

    // Query 2 — completed jobs per technician
    // LEFT JOIN ensures techs with 0 jobs still appear
    const techRows = await db
      .select({
        technicianName: users.fullName,
        completedJobs: sql<number>`COUNT(${bookings.id})::int`,
      })
      .from(users)
      .leftJoin(
        bookings,
        and(
          eq(bookings.technicianId, users.id),
          eq(bookings.status, "COMPLETED")
        )
      )
      .where(eq(users.role, "TECHNICIAN"))
      .groupBy(users.id, users.fullName)
      .orderBy(desc(sql`COUNT(${bookings.id})`));

    return {
      byStatus: {
        PENDING: statusRow.pending,
        CONFIRMED: statusRow.confirmed,
        IN_PROGRESS: statusRow.inProgress,
        COMPLETED: statusRow.completed,
        CANCELLED: statusRow.cancelled,
      },
      byTechnician: techRows.map((r) => ({
        technicianName: r.technicianName,
        completedJobs: r.completedJobs,
      })),
    };
  }
}

// ── Singleton ──────────────────────────────────────
export const analyticsRepository = new AnalyticsRepository();