import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifyToken, type TokenPayload } from "./auth";
import type { UserRole } from "../models/user";

// ── Hono env type – makes c.get('user') typed ─────
export type AppEnv = {
  Variables: {
    user: TokenPayload;
    requestId: string;
  };
};

// ── Auth middleware – verifies JWT ──────────────────
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  const cookieToken = getCookie(c, "token");

  if ((!header || !header.startsWith("Bearer ")) && !cookieToken) {
    return c.json(
      { success: false, message: "Authorization token required" },
      401
    );
  }

  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : cookieToken;

  try {
    const payload = verifyToken(token as string);

    if (!payload.is_active) {
      return c.json(
        { success: false, message: "Account is deactivated" },
        403
      );
    }

    c.set("user", payload);
    await next();
  } catch {
    return c.json(
      { success: false, message: "Invalid or expired token" },
      401
    );
  }
});

// ── Role middleware – restricts by role(s) ──────────
export function roleMiddleware(...allowed: UserRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");

    if (!allowed.includes(user.role as UserRole)) {
      return c.json(
        { success: false, message: "Insufficient permissions" },
        403
      );
    }

    await next();
  });
}
