import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { rateLimiter, resolveClientIp } from "../src/core/rate-limiter";

test("forwarded IP headers are ignored without a trusted proxy", () => {
  assert.equal(
    resolveClientIp("203.0.113.10", "203.0.113.11", "127.0.0.1", 0),
    "127.0.0.1"
  );
});

test("the configured proxy hop is selected from the right", () => {
  assert.equal(
    resolveClientIp("198.51.100.20, 203.0.113.10", undefined, "127.0.0.1", 1),
    "203.0.113.10"
  );
  assert.equal(
    resolveClientIp("198.51.100.20, 203.0.113.10", undefined, "127.0.0.1", 2),
    "198.51.100.20"
  );
});

test("invalid forwarded values fall back to the socket address", () => {
  assert.equal(
    resolveClientIp("attacker-controlled", "also-invalid", "127.0.0.1", 1),
    "127.0.0.1"
  );
});

test("rate limiter blocks requests above the configured window limit", async () => {
  const app = new Hono();
  app.use("*", rateLimiter(2, 60_000));
  app.get("/", (c) => c.text("ok"));

  assert.equal((await app.request("/")).status, 200);
  assert.equal((await app.request("/")).status, 200);
  const blocked = await app.request("/");
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"));
});
