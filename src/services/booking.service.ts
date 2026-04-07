import { bookingRepository } from "../repositories/booking.repository";
import { userRepository } from "../repositories/user.repository";
import type { CreateBookingInput, AssignTechnicianInput } from "../schemas/booking.schema";
import type { Booking, BookingStatus } from "../models/booking";
import { logger } from "../core/logger";
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

// ── Service ────────────────────────────────────────
export class BookingService {

  // ── Customer: create booking ─────────────────────
  async createBooking(
    customerId: string,
    input: CreateBookingInput
  ): Promise<CreateResult> {
    const reference = await bookingRepository.generateReference();

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

    return { ok: true, booking };
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

  // ── Admin: paginated list (optional status filter)─
  async getAllBookings(
    page: number,
    limit: number,
    status?: BookingStatus
  ) {
    return bookingRepository.findAll(page, limit, status);
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

    const allowed = ADMIN_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(newStatus)) {
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

    const allowed = TECHNICIAN_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(newStatus)) {
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
    return { ok: true, booking: updated };
  }
}

// ── Singleton ──────────────────────────────────────
export const bookingService = new BookingService();