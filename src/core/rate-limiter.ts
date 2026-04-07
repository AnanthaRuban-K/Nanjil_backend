import { createMiddleware } from "hono/factory";

interface RateRecord {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter.
 * Perfect for 6-tech / 3-admin scale.
 *
 * For large scale → replace with Redis-backed limiter.
 */
export function rateLimiter(maxAttempts: number, windowMs: number) {
  const store = new Map<string, RateRecord>();

  // Cleanup expired records every 60s
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store) {
      if (now > record.resetAt) store.delete(key);
    }
  }, 60_000).unref();

  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    const now = Date.now();
    const record = store.get(ip);

    if (record && now < record.resetAt) {
      if (record.count >= maxAttempts) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        c.header("Retry-After", retryAfter.toString());
        return c.json(
          {
            success: false,
            message: `Too many attempts. Try again in ${retryAfter}s`,
          },
          429
        );
      }
      record.count++;
    } else {
      store.set(ip, { count: 1, resetAt: now + windowMs });
    }

    await next();
  });
}