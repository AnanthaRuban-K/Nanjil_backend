import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { securityHeadersMiddleware } from "../src/core/security-headers";

test("API responses include defensive browser security headers", async () => {
  const app = new Hono();
  app.use("*", securityHeadersMiddleware);
  app.get("/", (c) => c.json({ success: true }));

  const response = await app.request("/");

  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin"
  );
  assert.match(
    response.headers.get("strict-transport-security") ?? "",
    /max-age=31536000/
  );
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /default-src 'none'/
  );
});
