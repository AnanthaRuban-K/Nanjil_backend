import { paymentRepository } from "../repositories/payment.repository";
import { bookingRepository } from "../repositories/booking.repository";
import type { RecordPaymentInput } from "../schemas/payment.schema";
import type { Payment } from "../models/payment";
import { logger } from "../core/logger";
// ── Result types (no HTTP leakage) ─────────────────
type RecordSuccess = { ok: true; payment: Payment };
type RecordFailure = {
  ok: false;
  error:
    | "BOOKING_NOT_FOUND"
    | "NOT_COMPLETED"
    | "ALREADY_PAID";
};
type RecordResult = RecordSuccess | RecordFailure;

export class PaymentService {
  async recordPayment(
    bookingId: string,
    input: RecordPaymentInput,
    adminId: string
  ): Promise<RecordResult> {
    // 1 — Booking must exist
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      return { ok: false, error: "BOOKING_NOT_FOUND" };
    }

    // 2 — Must be COMPLETED
    if (booking.status !== "COMPLETED") {
      return { ok: false, error: "NOT_COMPLETED" };
    }

    // 3 — Must be UNPAID (fast path)
    if (booking.paymentStatus !== "UNPAID") {
      return { ok: false, error: "ALREADY_PAID" };
    }

    // 4 — Atomic: insert payment + flip booking to PAID
    //     (transaction also guards against race-conditions)
    const payment = await paymentRepository.createWithBookingUpdate({
      bookingId,
      amount: input.amount.toFixed(2),
      paymentMode: input.paymentMode,
      upiReference: input.upiReference ?? null,
      recordedBy: adminId,
      paymentDate: input.paymentDate,
    });

    if (!payment) {
      return { ok: false, error: "ALREADY_PAID" };
    }

    logger.payment("RECORDED", bookingId, input.amount.toFixed(2));

    return { ok: true, payment };
  }
}

// ── Singleton ──────────────────────────────────────
export const paymentService = new PaymentService();