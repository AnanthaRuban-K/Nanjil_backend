import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { csrfMiddleware } from "../src/core/csrf";
import { logger } from "../src/core/logger";

test("csrf middleware blocks unsafe requests without matching token", async () => {
  const app = new Hono();
  app.use("*", csrfMiddleware);
  app.post("/protected", (c) => c.json({ ok: true }));

  const response = await app.request("/protected", { method: "POST" });
  assert.equal(response.status, 403);
});

test("csrf middleware allows unsafe requests with matching token", async () => {
  const app = new Hono();
  app.use("*", csrfMiddleware);
  app.post("/protected", (c) => c.json({ ok: true }));

  const response = await app.request("/protected", {
    method: "POST",
    headers: {
      Cookie: "csrf_token=abc123",
      "X-CSRF-Token": "abc123",
    },
  });
  assert.equal(response.status, 200);
});

test("csrf middleware skips login and register endpoints", async () => {
  const app = new Hono();
  app.use("*", csrfMiddleware);
  app.post("/api/v1/auth/login", (c) => c.json({ ok: true }));

  const response = await app.request("/api/v1/auth/login", {
    method: "POST",
  });
  assert.equal(response.status, 200);
});

test("logger sanitizer redacts sensitive values", () => {
  assert.deepEqual(
    logger.sanitize({
      password: "secret",
      nested: { token: "abc", keep: "visible" },
    }),
    {
      password: "[REDACTED]",
      nested: { token: "[REDACTED]", keep: "visible" },
    }
  );
});
