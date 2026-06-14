import { desc, eq, and, inArray, like } from "drizzle-orm";
import { db } from "../core/db";
import { payments, type Payment, type NewPayment } from "../models/payment";
import { bookings } from "../models/booking";

export class PaymentRepository {
  /** Check whether a payment already exists for a booking */
  async findByBookingId(bookingId: string): Promise<Payment | undefined> {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .limit(1);

    return rows[0];
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `NMI-${year}-`;
    const rows = await db
      .select({ invoice: payments.invoiceNumber })
      .from(payments)
      .where(like(payments.invoiceNumber, `${prefix}%`))
      .orderBy(desc(payments.invoiceNumber))
      .limit(1);

    const last = rows[0]?.invoice;
    const lastNum = last ? Number.parseInt(last.split("-").at(-1) || "", 10) : 0;
    const next = Number.isFinite(lastNum) ? lastNum + 1 : 1;
    return `${prefix}${next.toString().padStart(5, "0")}`;
  }

  /**
   * Atomic transaction:
   *  1. Optimistic-lock booking (must still be UNPAID)
   *  2. Insert payment row
   *  3. Flip booking.payment_status → PAID
   *
   * Returns null when the booking was already paid
   * (race-condition guard).
   */
  async createWithBookingUpdate(
    data: NewPayment
  ): Promise<Payment | null> {
    return db.transaction(async (tx) => {
      // Step 1 — lock: only update if still UNPAID
      const updated = await tx
        .update(bookings)
        .set({
          paymentStatus: "PAID",
          paymentRejectedReason: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, data.bookingId),
            inArray(bookings.paymentStatus, [
              "UNPAID",
              "PAYMENT_SUBMITTED",
              "PAYMENT_REJECTED",
            ])
          )
        )
        .returning({ id: bookings.id });

      if (updated.length === 0) return null; // already paid

      // Step 2 — insert payment record
      const [payment] = await tx
        .insert(payments)
        .values(data)
        .returning();

      return payment;
    });
  }
}

// ── Singleton ──────────────────────────────────────
export const paymentRepository = new PaymentRepository();
