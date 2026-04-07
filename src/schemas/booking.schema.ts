import { z } from "zod";

// ── Reusable date validator ────────────────────────
const futureDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
  .refine((val) => !isNaN(Date.parse(val)), "Must be a valid calendar date")
  .refine((val) => {
    const input = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return input >= today;
  }, "Date cannot be in the past");

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
  .refine((val) => !isNaN(Date.parse(val)), "Must be a valid calendar date");

// ── Status enum (reuse across schemas) ─────────────
const bookingStatusValues = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

// ── Create booking (CUSTOMER) ──────────────────────
export const createBookingSchema = z.object({
  serviceType: z
    .string()
    .trim()
    .min(2, "Service type must be at least 2 characters")
    .max(100, "Service type must be at most 100 characters"),

  issueDescription: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be at most 2000 characters"),

  serviceAddress: z
    .string()
    .trim()
    .min(10, "Address must be at least 10 characters")
    .max(500, "Address must be at most 500 characters"),

  preferredDate: futureDateSchema,
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// ── Assign technician (ADMIN) ──────────────────────
export const assignTechnicianSchema = z.object({
  technicianId: z.string().uuid("Must be a valid technician UUID"),
  scheduledDate: dateSchema.optional(),
});

export type AssignTechnicianInput = z.infer<typeof assignTechnicianSchema>;

// ── Update status (ADMIN / TECHNICIAN) ─────────────
export const updateStatusSchema = z.object({
  status: z.enum(bookingStatusValues, {
    errorMap: () => ({
      message: `Status must be one of: ${bookingStatusValues.join(", ")}`,
    }),
  }),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

// ── Pagination ─────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  limit: z.coerce.number().int().positive().max(100).catch(10),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ── Admin list filter (pagination + optional status)─
export const bookingFilterSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  limit: z.coerce.number().int().positive().max(100).catch(10),
  status: z.enum(bookingStatusValues).optional(),
});

export type BookingFilterInput = z.infer<typeof bookingFilterSchema>;

// ── UUID param validator ───────────────────────────
export const uuidParamSchema = z.string().uuid("Invalid ID format");