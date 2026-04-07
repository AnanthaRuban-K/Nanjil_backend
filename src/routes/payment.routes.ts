import { Hono } from "hono";
import {
  authMiddleware,
  roleMiddleware,
  type AppEnv,
} from "../core/middleware";
import { paymentService } from "../services/payment.service";
import { recordPaymentSchema } from "../schemas/payment.schema";
import { uuidParamSchema } from "../schemas/booking.schema";

const paymentRoutes = new Hono<AppEnv>();

paymentRoutes.use("*", authMiddleware);
paymentRoutes.use("*", roleMiddleware("ADMIN"));

// ────────────────────────────────────────────────────
// POST /:id/payment
// Mounted at /api/v1/admin/bookings  →
//   POST /api/v1/admin/bookings/:id/payment
// ────────────────────────────────────────────────────
paymentRoutes.post("/:id/payment", async (c) => {
  const bookingId = c.req.param("id");

  if (!uuidParamSchema.safeParse(bookingId).success) {
    return c.json(
      { success: false, message: "Invalid booking ID format" },
      400
    );
  }

  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = recordPaymentSchema.safeParse(body);

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
  const result = await paymentService.recordPayment(
    bookingId,
    parsed.data,
    user.sub
  );

  if (!result.ok) {
    const map: Record<string, { status: number; message: string }> = {
      BOOKING_NOT_FOUND: {
        status: 404,
        message: "Booking not found",
      },
      NOT_COMPLETED: {
        status: 409,
        message: "Payment can only be recorded for COMPLETED bookings",
      },
      ALREADY_PAID: {
        status: 409,
        message: "This booking has already been paid",
      },
    };
    const err = map[result.error];
    return c.json(
      { success: false, message: err.message },
      err.status as 404
    );
  }

  return c.json(
    {
      success: true,
      message: "Payment recorded successfully",
      data: result.payment,
    },
    201
  );
});

export { paymentRoutes };