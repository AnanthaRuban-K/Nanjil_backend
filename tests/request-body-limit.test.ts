import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import {
  MAX_REQUEST_BODY_BYTES,
  requestBodyLimitMiddleware,
} from "../src/core/request-body-limit";

function createApp() {
  const app = new Hono();
  app.use("/api/*", requestBodyLimitMiddleware);
  app.post("/api/test", async (c) => {
    await c.req.text();
    return c.json({ success: true });
  });
  return app;
}

test("request body limit accepts a small API request", async () => {
  const response = await createApp().request("/api/test", {
    method: "POST",
    body: "valid request",
  });

  assert.equal(response.status, 200);
});

test("request body limit rejects oversized API requests", async () => {
  const response = await createApp().request("/api/test", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Request body is too large",
  });
});
