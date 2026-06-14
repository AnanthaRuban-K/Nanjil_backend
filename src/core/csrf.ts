import { randomBytes, timingSafeEqual } from "crypto";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { config } from "./config";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const CSRF_MAX_AGE = 60 * 60 * 24;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SKIP_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
]);

function cookieOptions() {
  return {
    httpOnly: false,
    secure: config.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
    maxAge: CSRF_MAX_AGE,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return (
    aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer)
  );
}

export function issueCsrfToken(c: Parameters<typeof setCookie>[0]): string {
  const token = randomBytes(32).toString("hex");
  setCookie(c, CSRF_COOKIE, token, cookieOptions());
  return token;
}

export function clearCsrfToken(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, CSRF_COOKIE, {
    path: "/",
    secure: config.NODE_ENV === "production",
    sameSite: "Lax",
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  });
}

export const csrfMiddleware = createMiddleware(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method) || SKIP_PATHS.has(c.req.path)) {
    await next();
    return;
  }

  const cookieToken = getCookie(c, CSRF_COOKIE);
  const headerToken = c.req.header(CSRF_HEADER);

  if (
    !cookieToken ||
    !headerToken ||
    !constantTimeEqual(cookieToken, headerToken)
  ) {
    return c.json({ success: false, message: "Invalid CSRF token" }, 403);
  }

  await next();
});
