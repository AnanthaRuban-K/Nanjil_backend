import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { authService } from "../services/auth.service";
import {
  forgotPasswordSchema,
  registerSchema,
  loginSchema,
  resetPasswordSchema,
} from "../schemas/auth.schema";
import { rateLimiter } from "../core/rate-limiter";
import { config } from "../core/config";
import { clearCsrfToken, issueCsrfToken } from "../core/csrf";
import { authMiddleware, type AppEnv } from "../core/middleware";

const auth = new Hono<AppEnv>();

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24;

function setAuthCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, "token", token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  });
}

// ────────────────────────────────────────────────────
// POST /api/v1/auth/register  →  CUSTOMER only
// ────────────────────────────────────────────────────
auth.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = registerSchema.safeParse(body);

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

  const result = await authService.register(parsed.data);

  if (!result.ok) {
    return c.json(
      { success: false, message: "Email is already registered" },
      409
    );
  }

  setAuthCookie(c, result.token);
  issueCsrfToken(c);

  return c.json(
    {
      success: true,
      message: "Registration successful",
      data: { user: result.user, token: result.token },
    },
    201
  );
});

// ────────────────────────────────────────────────────
// POST /api/v1/auth/login  →  any role
// ────────────────────────────────────────────────────
auth.post("/login", rateLimiter(5, 60_000), async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = loginSchema.safeParse(body);

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

  const result = await authService.login(parsed.data);

  if (!result.ok) {
    if (result.error === "ACCOUNT_INACTIVE") {
      return c.json(
        { success: false, message: "Account is deactivated — contact admin" },
        403
      );
    }
    // INVALID_CREDENTIALS  → never reveal which field is wrong
    return c.json(
      { success: false, message: "Invalid email or password" },
      401
    );
  }

  setAuthCookie(c, result.token);
  issueCsrfToken(c);

  return c.json(
    {
      success: true,
      message: "Login successful",
      data: { user: result.user, token: result.token },
    },
    200
  );
});

auth.post("/forgot-password", rateLimiter(5, 60_000), async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = forgotPasswordSchema.safeParse(body);

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

  const result = await authService.forgotPassword(parsed.data);

  return c.json({
    success: true,
    message:
      "If an account exists for that email, a reset link has been sent.",
    data: result.resetUrl ? { resetUrl: result.resetUrl } : undefined,
  });
});

auth.post("/reset-password", rateLimiter(5, 60_000), async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json(
      { success: false, message: "Request body must be valid JSON" },
      400
    );
  }

  const parsed = resetPasswordSchema.safeParse(body);

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

  const result = await authService.resetPassword(parsed.data);

  if (!result.ok) {
    return c.json(
      {
        success: false,
        message:
          result.error === "ACCOUNT_INACTIVE"
            ? "Account is deactivated"
            : "Reset link is invalid or expired",
      },
      result.error === "ACCOUNT_INACTIVE" ? 403 : 400
    );
  }

  return c.json({
    success: true,
    message: "Password reset successful",
  });
});

auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const result = await authService.me(user.sub);

  if (!result.ok) {
    return c.json(
      {
        success: false,
        message:
          result.error === "ACCOUNT_INACTIVE"
            ? "Account is deactivated"
            : "User not found",
      },
      result.error === "ACCOUNT_INACTIVE" ? 403 : 404
    );
  }

  issueCsrfToken(c);

  return c.json({
    success: true,
    data: { user: result.user },
  });
});

auth.post("/logout", (c) => {
  deleteCookie(c, "token", {
    path: "/",
    secure: config.NODE_ENV === "production",
    sameSite: "Lax",
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  });
  clearCsrfToken(c);

  return c.json({
    success: true,
    message: "Logout successful",
  });
});

export { auth as authRoutes };
