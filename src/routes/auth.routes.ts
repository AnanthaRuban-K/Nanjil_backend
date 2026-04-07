import { Hono } from "hono";
import { authService } from "../services/auth.service";
import { registerSchema, loginSchema } from "../schemas/auth.schema";

const auth = new Hono();

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
auth.post("/login", async (c) => {
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

  return c.json(
    {
      success: true,
      message: "Login successful",
      data: { user: result.user, token: result.token },
    },
    200
  );
});

export { auth as authRoutes };