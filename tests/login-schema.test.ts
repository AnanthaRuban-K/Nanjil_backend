import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema } from "../src/schemas/auth.schema";

test("login accepts and normalizes an email identifier", () => {
  const parsed = loginSchema.safeParse({
    identifier: "  USER@Example.COM ",
    password: "Password123",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.identifier, "user@example.com");
});

test("login accepts and normalizes a phone identifier", () => {
  const parsed = loginSchema.safeParse({
    identifier: "+91 84284-89046",
    password: "Password123",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.identifier, "+918428489046");
});

test("login rejects an invalid identifier", () => {
  assert.equal(
    loginSchema.safeParse({
      identifier: "not-an-email-or-phone",
      password: "Password123",
    }).success,
    false
  );
});

test("login remains compatible with the legacy email request", () => {
  const parsed = loginSchema.safeParse({
    email: "USER@Example.COM",
    password: "Password123",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.identifier, "user@example.com");
});
