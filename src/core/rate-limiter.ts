import { createMiddleware } from "hono/factory";
import { getConnInfo } from "@hono/node-server/conninfo";
import { isIP } from "node:net";
import { config } from "./config";

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
    let remoteAddress = "unknown";
    try {
      remoteAddress = getConnInfo(c).remote.address ?? "unknown";
    } catch {
      // Synthetic requests in tests may not expose a Node socket.
    }

    const ip = resolveClientIp(
      c.req.header("x-forwarded-for"),
      c.req.header("x-real-ip"),
      remoteAddress,
      config.TRUST_PROXY_HOPS
    );

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

export function resolveClientIp(
  forwardedFor: string | undefined,
  realIp: string | undefined,
  remoteAddress: string,
  trustedProxyHops: number
): string {
  if (trustedProxyHops <= 0) return remoteAddress;

  const forwarded = (forwardedFor ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => isIP(value) !== 0);
  const forwardedIndex = forwarded.length - trustedProxyHops;

  if (forwardedIndex >= 0) return forwarded[forwardedIndex];
  if (trustedProxyHops === 1 && realIp && isIP(realIp.trim()) !== 0) {
    return realIp.trim();
  }

  return remoteAddress;
}
