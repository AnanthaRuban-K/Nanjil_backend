import { randomUUID } from "crypto";
import { createMiddleware } from "hono/factory";

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const requestId = c.req.header("x-request-id") || randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  await next();
});
