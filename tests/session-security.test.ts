import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { generateToken } from "../src/core/auth";
import {
  authMiddleware,
  roleMiddleware,
  type AppEnv,
} from "../src/core/middleware";
import type { User } from "../src/models/user";
import { userRepository } from "../src/repositories/user.repository";

const baseUser: User = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Security Test",
  email: "security@example.com",
  phone: "9876543210",
  hashedPassword: "not-used-in-this-test",
  role: "ADMIN",
  isActive: true,
  tokenVersion: 3,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

async function withRepositoryUser(
  user: User | undefined,
  callback: () => Promise<void>
) {
  const original = userRepository.findById;
  userRepository.findById = async () => user;
  try {
    await callback();
  } finally {
    userRepository.findById = original;
  }
}

function createProtectedApp(...roles: User["role"][]) {
  const app = new Hono<AppEnv>();
  app.get(
    "/protected",
    authMiddleware,
    ...(roles.length ? [roleMiddleware(...roles)] : []),
    (c) => c.json({ role: c.get("user").role })
  );
  return app;
}

test("password or session version changes invalidate an old JWT", async () => {
  const token = generateToken(baseUser);
  await withRepositoryUser(
    { ...baseUser, tokenVersion: baseUser.tokenVersion + 1 },
    async () => {
      const response = await createProtectedApp().request("/protected", {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 401);
    }
  );
});

test("deactivated accounts are rejected even when the JWT says active", async () => {
  const token = generateToken(baseUser);
  await withRepositoryUser({ ...baseUser, isActive: false }, async () => {
    const response = await createProtectedApp().request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
  });
});

test("authorization uses the current database role instead of a stale JWT role", async () => {
  const token = generateToken(baseUser);
  await withRepositoryUser({ ...baseUser, role: "CUSTOMER" }, async () => {
    const response = await createProtectedApp("ADMIN").request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
  });
});
