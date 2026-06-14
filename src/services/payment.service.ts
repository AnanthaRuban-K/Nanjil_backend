import { paymentRepository } from "../repositories/payment.repository";
import { bookingRepository } from "../repositories/booking.repository";
import type {
  RecordPaymentInput,
  RejectPaymentSubmissionInput,
  SubmitUpiPaymentInput,
} from "../schemas/payment.schema";
import type { Payment } from "../models/payment";
import type { Booking } from "../models/booking";
import { logger } from "../core/logger";
import { userRepository } from "../repositories/user.repository";
import { notificationService } from "./notification.service";

type RecordSuccess = { ok: true; payment: Payment };
type RecordFailure = {
  ok: false;
  error:
    | "BOOKING_NOT_FOUND"
    | "NOT_COMPLETED"
    | "ALREADY_PAID"
    | "AMOUNT_REQUIRED";
};
type RecordResult = RecordSuccess | RecordFailure;

type SubmitSuccess = { ok: true; booking: Booking };
type SubmitFailure = {
  ok: false;
  error:
    | "BOOKING_NOT_FOUND"
    | "FORBIDDEN"
    | "NOT_COMPLETED"
    | "ALREADY_PAID"
    | "INVALID_STATUS";
};
type SubmitResult = SubmitSuccess | SubmitFailure;

type RejectSuccess = { ok: true; booking: Booking };
type RejectFailure = {
  ok: false;
  error: "BOOKING_NOT_FOUND" | "NO_SUBMISSION" | "ALREADY_PAID";
};
type RejectResult = RejectSuccess | RejectFailure;

export class PaymentService {
  async recordPayment(
    bookingId: string,
    input: RecordPaymentInput,
    adminId: string
  ): Promise<RecordResult> {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      return { ok: false, error: "BOOKING_NOT_FOUND" };
    }

    if (booking.status !== "COMPLETED") {
      return { ok: false, error: "NOT_COMPLETED" };
    }

    if (booking.paymentStatus === "PAID") {
      return { ok: false, error: "ALREADY_PAID" };
    }

    const amount = input.amount ?? Number(booking.serviceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "AMOUNT_REQUIRED" };
    }

    const payment = await paymentRepository.createWithBookingUpdate({
      bookingId,
      invoiceNumber: await paymentRepository.generateInvoiceNumber(),
      amount: amount.toFixed(2),
      paymentMode: input.paymentMode,
      upiReference: input.upiReference ?? booking.submittedUpiReference ?? null,
      recordedBy: adminId,
      paymentDate: input.paymentDate,
    });

    if (!payment) {
      return { ok: false, error: "ALREADY_PAID" };
    }

    logger.payment("RECORDED", bookingId, amount.toFixed(2));
    return { ok: true, payment };
  }

  async getReceipt(customerId: string, bookingId: string) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return { ok: false as const, error: "BOOKING_NOT_FOUND" };
    if (booking.customerId !== customerId) {
      return { ok: false as const, error: "FORBIDDEN" };
    }
    if (booking.paymentStatus !== "PAID") {
      return { ok: false as const, error: "NOT_PAID" };
    }

    const payment = await paymentRepository.findByBookingId(bookingId);
    if (!payment) return { ok: false as const, error: "PAYMENT_NOT_FOUND" };

    return { ok: true as const, booking, payment };
  }

  async submitUpiPayment(
    customerId: string,
    bookingId: string,
    input: SubmitUpiPaymentInput
  ): Promise<SubmitResult> {
    const booking = await bookingRepository.findById(bookingId);

    if (!booking) {
      return { ok: false, error: "BOOKING_NOT_FOUND" };
    }

    if (booking.customerId !== customerId) {
      return { ok: false, error: "FORBIDDEN" };
    }

    if (booking.status !== "COMPLETED") {
      return { ok: false, error: "NOT_COMPLETED" };
    }

    if (booking.paymentStatus === "PAID") {
      return { ok: false, error: "ALREADY_PAID" };
    }

    if (booking.paymentStatus === "PAYMENT_SUBMITTED") {
      return { ok: false, error: "INVALID_STATUS" };
    }

    const updated = await bookingRepository.submitUpiPayment(
      bookingId,
      customerId,
      input.upiReference
    );

    if (!updated) {
      return { ok: false, error: "INVALID_STATUS" };
    }

    logger.payment("SUBMITTED", bookingId, input.upiReference);
    const customer = await userRepository.findById(customerId);
    void notificationService
      .paymentSubmitted(updated, customer)
      .catch((error) =>
        logger.warn("NOTIFY", "Payment-submitted notification failed", {
          error: error.message,
        })
      );
    return { ok: true, booking: updated };
  }

  async rejectPaymentSubmission(
    bookingId: string,
    input: RejectPaymentSubmissionInput
  ): Promise<RejectResult> {
    const booking = await bookingRepository.findById(bookingId);

    if (!booking) {
      return { ok: false, error: "BOOKING_NOT_FOUND" };
    }

    if (booking.paymentStatus === "PAID") {
      return { ok: false, error: "ALREADY_PAID" };
    }

    if (booking.paymentStatus !== "PAYMENT_SUBMITTED") {
      return { ok: false, error: "NO_SUBMISSION" };
    }

    const updated = await bookingRepository.rejectPaymentSubmission(
      bookingId,
      input.reason ?? null
    );

    if (!updated) {
      return { ok: false, error: "NO_SUBMISSION" };
    }

    logger.payment("REJECTED", bookingId, input.reason ?? "");
    return { ok: true, booking: updated };
  }
}

export const paymentService = new PaymentService();
