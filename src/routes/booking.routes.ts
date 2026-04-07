import { Hono } from "hono";
import { authMiddleware, roleMiddleware, type AppEnv } from "../core/middleware";
import { bookingService } from "../services/booking.service";
import {
  createBookingSchema,
  assignTechnicianSchema,
  updateStatusSchema,
  paginationSchema,
  bookingFilterSchema,
  uuidParamSchema,
} from "../schemas/booking.schema";

// ═══════════════════════════════════════════════════
//  CUSTOMER  –  /api/v1/bookings
// ═══════════════════════════════════════════════════
const customerBookingRoutes = new Hono<AppEnv>();
customerBookingRoutes.use("*", authMiddleware);
customerBookingRoutes.use("*", roleMiddleware("CUSTOMER"));

// ── POST /  →  Create booking ──────────────────────
customerBookingRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = createBookingSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  const user = c.get("user");
  const result = await bookingService.createBooking(user.sub, parsed.data);

  return c.json(
    {
      success: true,
      message: "Booking created successfully",
      data: result.booking,
    },
    201
  );
});

// ── GET /my  →  Customer's booking list ────────────
customerBookingRoutes.get("/my", async (c) => {
  const params = paginationSchema.parse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });

  const user = c.get("user");
  const { data, total } = await bookingService.getCustomerBookings(
    user.sub,
    params.page,
    params.limit
  );

  return c.json({
    success: true,
    data,
    meta: { page: params.page, limit: params.limit, total },
  });
});

// ── GET /my/:id  →  Single booking detail ──────────
customerBookingRoutes.get("/my/:id", async (c) => {
  const bookingId = c.req.param("id");

  if (!uuidParamSchema.safeParse(bookingId).success) {
    return c.json({ success: false, message: "Invalid booking ID format" }, 400);
  }

  const user = c.get("user");
  const result = await bookingService.getCustomerBookingById(user.sub, bookingId);

  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 403;
    const message =
      result.error === "NOT_FOUND"
        ? "Booking not found"
        : "You do not have access to this booking";
    return c.json({ success: false, message }, status);
  }

  return c.json({ success: true, data: result.booking });
});


// ═══════════════════════════════════════════════════
//  ADMIN  –  /api/v1/admin/bookings
// ═══════════════════════════════════════════════════
const adminBookingRoutes = new Hono<AppEnv>();
adminBookingRoutes.use("*", authMiddleware);
adminBookingRoutes.use("*", roleMiddleware("ADMIN"));

// ── GET /  →  All bookings (optional status filter)─
adminBookingRoutes.get("/", async (c) => {
  const parsed = bookingFilterSchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
    status: c.req.query("status") || undefined,
  });

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Invalid query parameters",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  const { page, limit, status } = parsed.data;
  const { data, total } = await bookingService.getAllBookings(page, limit, status);

  return c.json({
    success: true,
    data,
    meta: { page, limit, total },
  });
});

// ── PATCH /:id/assign  →  Assign technician ───────
adminBookingRoutes.patch("/:id/assign", async (c) => {
  const bookingId = c.req.param("id");

  if (!uuidParamSchema.safeParse(bookingId).success) {
    return c.json({ success: false, message: "Invalid booking ID format" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = assignTechnicianSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  const user = c.get("user");
  const result = await bookingService.assignTechnician(
    bookingId,
    parsed.data,
    user.sub
  );

  if (!result.ok) {
    const map: Record<string, { status: number; message: string }> = {
      NOT_FOUND:           { status: 404, message: "Booking not found" },
      INVALID_STATUS:      { status: 409, message: "Only PENDING bookings can be assigned" },
      INVALID_TECHNICIAN:  { status: 400, message: "Invalid technician ID or user is not a technician" },
      TECHNICIAN_INACTIVE: { status: 400, message: "Technician account is deactivated" },
    };
    const err = map[result.error];
    return c.json({ success: false, message: err.message }, err.status as 400);
  }

  return c.json({
    success: true,
    message: "Technician assigned – booking confirmed",
    data: result.booking,
  });
});

// ── PATCH /:id/status  →  Change booking status ───
adminBookingRoutes.patch("/:id/status", async (c) => {
  const bookingId = c.req.param("id");

  if (!uuidParamSchema.safeParse(bookingId).success) {
    return c.json({ success: false, message: "Invalid booking ID format" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  const user = c.get("user");
  const result = await bookingService.adminUpdateStatus(
    bookingId,
    parsed.data.status,
    user.sub
  );

  if (!result.ok) {
    const map: Record<string, { status: number; message: string }> = {
      NOT_FOUND:          { status: 404, message: "Booking not found" },
      INVALID_TRANSITION: { status: 409, message: "This status transition is not allowed" },
    };
    const err = map[result.error];
    return c.json({ success: false, message: err.message }, err.status as 404);
  }

  return c.json({
    success: true,
    message: `Booking status updated to ${parsed.data.status}`,
    data: result.booking,
  });
});


// ═══════════════════════════════════════════════════
//  TECHNICIAN  –  /api/v1/technician/jobs
// ═══════════════════════════════════════════════════
const technicianJobRoutes = new Hono<AppEnv>();
technicianJobRoutes.use("*", authMiddleware);
technicianJobRoutes.use("*", roleMiddleware("TECHNICIAN"));

// ── GET /  →  My assigned jobs ─────────────────────
technicianJobRoutes.get("/", async (c) => {
  const params = paginationSchema.parse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });

  const user = c.get("user");
  const { data, total } = await bookingService.getTechnicianJobs(
    user.sub,
    params.page,
    params.limit
  );

  return c.json({
    success: true,
    data,
    meta: { page: params.page, limit: params.limit, total },
  });
});

// ── PATCH /:id/status  →  Update job status ────────
technicianJobRoutes.patch("/:id/status", async (c) => {
  const bookingId = c.req.param("id");

  if (!uuidParamSchema.safeParse(bookingId).success) {
    return c.json({ success: false, message: "Invalid booking ID format" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  const user = c.get("user");
  const result = await bookingService.technicianUpdateStatus(
    bookingId,
    parsed.data.status,
    user.sub
  );

  if (!result.ok) {
    const map: Record<string, { status: number; message: string }> = {
      NOT_FOUND:          { status: 404, message: "Booking not found" },
      FORBIDDEN:          { status: 403, message: "This job is not assigned to you" },
      INVALID_TRANSITION: { status: 409, message: "This status transition is not allowed" },
    };
    const err = map[result.error];
    return c.json({ success: false, message: err.message }, err.status as 404);
  }

  return c.json({
    success: true,
    message: `Job status updated to ${parsed.data.status}`,
    data: result.booking,
  });
});


export { customerBookingRoutes, adminBookingRoutes, technicianJobRoutes };