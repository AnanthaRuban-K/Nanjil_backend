import { Hono } from "hono";
import {
  authMiddleware,
  roleMiddleware,
  type AppEnv,
} from "../core/middleware";
import { analyticsService } from "../services/analytics.service";
import { revenueFilterSchema } from "../schemas/analytics.schema";

// ═══════════════════════════════════════════════════
// Dashboard  –  /api/v1/admin/dashboard
// ═══════════════════════════════════════════════════
const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", authMiddleware);
dashboardRoutes.use("*", roleMiddleware("ADMIN"));

// GET /api/v1/admin/dashboard/summary
dashboardRoutes.get("/summary", async (c) => {
  const summary = await analyticsService.getDashboardSummary();

  return c.json({
    success: true,
    data: summary,
  });
});

// ═══════════════════════════════════════════════════
// Analytics  –  /api/v1/admin/analytics
// ═══════════════════════════════════════════════════
const analyticsRoutes = new Hono<AppEnv>();
analyticsRoutes.use("*", authMiddleware);
analyticsRoutes.use("*", roleMiddleware("ADMIN"));

// GET /api/v1/admin/analytics/revenue?date_from=...&date_to=...
analyticsRoutes.get("/revenue", async (c) => {
  const parsed = revenueFilterSchema.safeParse({
    date_from: c.req.query("date_from"),
    date_to: c.req.query("date_to"),
  });

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

  const revenue = await analyticsService.getRevenueAnalytics(
    parsed.data.date_from,
    parsed.data.date_to
  );

  return c.json({ success: true, data: revenue });
});

// GET /api/v1/admin/analytics/bookings
analyticsRoutes.get("/bookings", async (c) => {
  const analytics = await analyticsService.getBookingAnalytics();

  return c.json({ success: true, data: analytics });
});

export { dashboardRoutes, analyticsRoutes };