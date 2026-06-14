import { bookingRepository } from "../repositories/booking.repository";
import { userRepository } from "../repositories/user.repository";
import type {
  CreateBookingInput,
  AssignTechnicianInput,
  UpdateServiceAmountInput,
  BookingRequestInput,
} from "../schemas/booking.schema";
import type { Booking, BookingStatus, PaymentStatus } from "../models/booking";
import { logger } from "../core/logger";
import { notificationService } from "./notification.service";
// ── Status transition maps ─────────────────────────
const ADMIN_TRANSITIONS: Record<string, BookingStatus[]> = {
  PENDING:     ["CANCELLED"],
  CONFIRMED:   ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED:   [],
  CANCELLED:   [],
};

const TECHNICIAN_TRANSITIONS: Record<string, BookingStatus[]> = {
  CONFIRMED:   ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  PENDING:     [],
  COMPLETED:   [],
  CANCELLED:   [],
};

export function canAdminTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  return (ADMIN_TRANSITIONS[from] ?? []).includes(to);
}

export function canTechnicianTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  return (TECHNICIAN_TRANSITIONS[from] ?? []).includes(to);
}

const MAX_REFERENCE_RETRIES = 5;

function isBookingReferenceConflict(error: unknown): boolean {
  const err = error as {
    code?: string;
    constraint?: string;
    detail?: string;
    cause?: unknown;
  };

  const isUniqueViolation = err.code === "23505";
  const mentionsBookingReference =
    err.constraint?.includes("booking_reference") ||
    err.detail?.includes("booking_reference");

  if (isUniqueViolation && mentionsBookingReference) return true;
  if (err.cause) return isBookingReferenceConflict(err.cause);
  return false;
}

// ── Result types (no HTTP leakage) ─────────────────
type CreateResult =
  | { ok: true; booking: Booking }

type DetailResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" }

type AssignResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: "NOT_FOUND" | "INVALID_STATUS" | "INVALID_TECHNICIAN" | "TECHNICIAN_INACTIVE" }

type StatusResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: "NOT_FOUND" | "INVALID_TRANSITION" | "FORBIDDEN" }

type AmountResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: "NOT_FOUND" | "ALREADY_PAID" }

type RequestResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" | "CLOSED" }

// ── Service ────────────────────────────────────────
export class BookingService {

  // ── Customer: create booking ─────────────────────
  async createBooking(
    customerId: string,
    input: CreateBookingInput
  ): Promise<CreateResult> {
    for (let attempt = 1; attempt <= MAX_REFERENCE_RETRIES; attempt++) {
      const reference = await bookingRepository.generateReference();

      try {
        const booking = await bookingRepository.createWithLog(
          {
            bookingReference: reference,
            customerId,
            serviceType: input.serviceType,
            issueDescription: input.issueDescription,
            serviceAddress: input.serviceAddress,
            preferredDate: input.preferredDate,
            status: "PENDING",
          },
          customerId
        );

        const customer = await userRepository.findById(customerId);
        void notificationService
          .bookingCreated(booking, customer)
          .catch((error) =>
            logger.warn("NOTIFY", "Booking-created notification failed", {
              error: error.message,
            })
          );

        return { ok: true, booking };
      } catch (error) {
        if (
          attempt < MAX_REFERENCE_RETRIES &&
          isBookingReferenceConflict(error)
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("Failed to create a unique booking reference");
  }

  // ── Customer: paginated list ─────────────────────
  async getCustomerBookings(
    customerId: string,
    page: number,
    limit: number
  ) {
    return bookingRepository.findByCustomerId(customerId, page, limit);
  }

  // ── Customer: single booking detail ──────────────
  async getCustomerBookingById(
    customerId: string,
    bookingId: string
  ): Promise<DetailResult> {
    const booking = await bookingRepository.findById(bookingId);

    if (!booking) return { ok: false, error: "NOT_FOUND" };
    if (booking.customerId !== customerId) return { ok: false, error: "FORBIDDEN" };

    return { ok: true, booking };
  }

  async submitCustomerRequest(
    customerId: string,
    bookingId: string,
    input: BookingRequestInput
  ): Promise<RequestResult> {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return { ok: false, error: "NOT_FOUND" };
    if (booking.customerId !== customerId) return { ok: false, error: "FORBIDDEN" };
    if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
      return { ok: false, error: "CLOSED" };
    }

    const customer = await userRepository.findById(customerId);
    void notificationService
      .customerRequest(booking, customer, input)
      .catch((error) =>
        logger.warn("NOTIFY", "Customer request notification failed", {
          error: error.message,
        })
      );

    return { ok: true, booking };
  }

  // ── Admin: paginated list (optional status filter)─
  async getAllBookings(
    page: number,
    limit: number,
    status?: BookingStatus,
    paymentStatus?: PaymentStatus,
    search?: string,
    dateFrom?: string,
    dateTo?: string
  ) {
    return bookingRepository.findAll(
      page,
      limit,
      status,
      paymentStatus,
      search,
      dateFrom,
      dateTo
    );
  }

  // ── Admin: assign technician ─────────────────────
  async assignTechnician(
    bookingId: string,
    input: AssignTechnicianInput,
    adminId: string
  ): Promise<AssignResult> {
    // 1. Booking must exist
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return { ok: false, error: "NOT_FOUND" };
    if (booking.status !== "PENDING") return { ok: false, error: "INVALID_STATUS" };

    // 2. Technician must be a valid, active technician
    const technician = await userRepository.findById(input.technicianId);
    if (!technician || technician.role !== "TECHNICIAN") {
      return { ok: false, error: "INVALID_TECHNICIAN" };
    }
    if (!technician.isActive) {
      return { ok: false, error: "TECHNICIAN_INACTIVE" };
    }

    // 3. Atomic update (WHERE status = PENDING guards race conditions)
    const updated = await bookingRepository.assignTechnicianWithLog(
      bookingId,
      input.technicianId,
      adminId,
      input.scheduledDate
    );

    if (!updated) return { ok: false, error: "INVALID_STATUS" };
    logger.statusChange(bookingId, "PENDING", "CONFIRMED", adminId);
    void notificationService
      .technicianAssigned(updated, technician)
      .catch((error) =>
        logger.warn("NOTIFY", "Technician-assigned notification failed", {
          error: error.message,
        })
      );
    return { ok: true, booking: updated };
  }

  // ── Admin: update status ─────────────────────────
  async adminUpdateStatus(
    bookingId: string,
    newStatus: BookingStatus,
    adminId: string
  ): Promise<StatusResult> {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return { ok: false, error: "NOT_FOUND" };

    if (!canAdminTransition(booking.status, newStatus)) {
      return { ok: false, error: "INVALID_TRANSITION" };
    }

    const updated = await bookingRepository.updateStatusWithLog(
      bookingId,
      booking.status,
      newStatus,
      adminId
    );

    if (!updated) return { ok: false, error: "INVALID_TRANSITION" };
    logger.statusChange(bookingId, booking.status, newStatus, adminId);

    if (newStatus === "COMPLETED") {
      const customer = await userRepository.findById(booking.customerId);
      void notificationService
        .paymentPending(updated, customer)
        .catch((error) =>
          logger.warn("NOTIFY", "Payment-pending notification failed", {
            error: error.message,
          })
        );
    }

    return { ok: true, booking: updated };
  }

  async updateServiceAmount(
    bookingId: string,
    input: UpdateServiceAmountInput
  ): Promise<AmountResult> {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return { ok: false, error: "NOT_FOUND" };
    if (booking.paymentStatus === "PAID") {
      return { ok: false, error: "ALREADY_PAID" };
    }

    const updated = await bookingRepository.updateServiceAmount(
      bookingId,
      input.serviceAmount.toFixed(2)
    );

    if (!updated) return { ok: false, error: "NOT_FOUND" };
    return { ok: true, booking: updated };
  }

  // ── Technician: paginated jobs list ──────────────
  async getTechnicianJobs(
    technicianId: string,
    page: number,
    limit: number
  ) {
    return bookingRepository.findByTechnicianId(technicianId, page, limit);
  }

  // ── Technician: update job status ────────────────
  async technicianUpdateStatus(
    bookingId: string,
    newStatus: BookingStatus,
    technicianId: string
  ): Promise<StatusResult> {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return { ok: false, error: "NOT_FOUND" };

    // Technician can only touch their own assigned jobs
    if (booking.technicianId !== technicianId) {
      return { ok: false, error: "FORBIDDEN" };
    }

    if (!canTechnicianTransition(booking.status, newStatus)) {
      return { ok: false, error: "INVALID_TRANSITION" };
    }

    const updated = await bookingRepository.updateStatusWithLog(
      bookingId,
      booking.status,
      newStatus,
      technicianId
    );

    if (!updated) return { ok: false, error: "INVALID_TRANSITION" };
    logger.statusChange(bookingId, booking.status, newStatus, technicianId);
    if (newStatus === "COMPLETED") {
      const customer = await userRepository.findById(booking.customerId);
      void notificationService
        .paymentPending(updated, customer)
        .catch((error) =>
          logger.warn("NOTIFY", "Payment-pending notification failed", {
            error: error.message,
          })
        );
    }
    return { ok: true, booking: updated };
  }
}

// ── Singleton ──────────────────────────────────────
export const bookingService = new BookingService();
