import { createMiddleware } from "hono/factory";

export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  await next();
});
