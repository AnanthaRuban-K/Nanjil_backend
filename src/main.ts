import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

import { config } from "./core/config";
import { csrfMiddleware } from "./core/csrf";
import { checkConnection, testConnection } from "./core/db";
import { logger } from "./core/logger";
import { requestIdMiddleware } from "./core/request-id";
import { securityHeadersMiddleware } from "./core/security-headers";
import type { AppEnv } from "./core/middleware";

// ── Route imports ──────────────────────────────────
import { authRoutes } from "./routes/auth.routes";
import {
  customerBookingRoutes,
  adminBookingRoutes,
  technicianJobRoutes,
} from "./routes/booking.routes";
import { paymentRoutes } from "./routes/payment.routes";
import {
  dashboardRoutes,
  analyticsRoutes,
} from "./routes/analytics.routes";
import { adminUserRoutes } from "./routes/user.routes";

const app = new Hono<AppEnv>();

// ── CORS — restrict in production ──────────────────
app.use(
  "*",
  cors({
    origin: config.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Request-ID",
    ],
    credentials: true,
    maxAge: 86400,
  })
);

// ── Request logging ────────────────────────────────
app.use("*", requestIdMiddleware);
app.use("*", securityHeadersMiddleware);
app.use("*", honoLogger());
app.use("*", csrfMiddleware);

// ── Health check (with DB status) ──────────────────
app.get("/api/v1/health", async (c) => {
  const isHealthy = await checkConnection();

  return c.json(
    {
      success: isHealthy,
      status: isHealthy ? "healthy" : "degraded",
      message: "Nanjil MEP Service API",
      data: {
        database: isHealthy ? "connected" : "disconnected",
        environment: config.NODE_ENV,
        timestamp: new Date().toISOString(),
      },
    },
    isHealthy ? 200 : 503
  );
});

// ── Auth routes (Step 1) ───────────────────────────
app.route("/api/v1/auth", authRoutes);

// ── Booking routes (Step 2) ────────────────────────
app.route("/api/v1/bookings", customerBookingRoutes);
app.route("/api/v1/admin/bookings", adminBookingRoutes);
app.route("/api/v1/technician/jobs", technicianJobRoutes);

// ── Payment & Analytics routes (Step 3) ────────────
app.route("/api/v1/admin/bookings", paymentRoutes);
app.route("/api/v1/admin/dashboard", dashboardRoutes);
app.route("/api/v1/admin/analytics", analyticsRoutes);
app.route("/api/v1/admin", adminUserRoutes);

// ── 404 fallback ───────────────────────────────────
app.notFound((c) => {
  return c.json({ success: false, message: "Route not found" }, 404);
});

// ── Global error handler (sanitized in prod) ───────
app.onError((err, c) => {
  logger.error("UNHANDLED", err.message, {
    requestId: c.get("requestId"),
    stack: config.NODE_ENV !== "production" ? err.stack : undefined,
  });

  return c.json(
    {
      success: false,
      message:
        config.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    },
    500
  );
});

// ── Bootstrap ──────────────────────────────────────
async function bootstrap() {
  await testConnection();

  serve(
    {
      fetch: app.fetch,
      port: config.PORT,
    },
    (info) => {
      logger.info("SERVER", `Running on http://localhost:${info.port}`);
      logger.info("SERVER", `Environment: ${config.NODE_ENV}`);
      logger.info("SERVER", `CORS origin: ${config.CORS_ORIGIN}`);
    }
  );
}

// ── Graceful shutdown ──────────────────────────────
process.on("SIGTERM", async () => {
  logger.info("SERVER", "SIGTERM received — shutting down");
  const { closeConnection } = await import("./core/db");
  await closeConnection();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SERVER", "SIGINT received — shutting down");
  const { closeConnection } = await import("./core/db");
  await closeConnection();
  process.exit(0);
});

bootstrap().catch((err) => {
  console.error("❌  Failed to start server:", err);
  process.exit(1);
});
