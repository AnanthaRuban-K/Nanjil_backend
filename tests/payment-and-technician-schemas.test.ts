import assert from "node:assert/strict";
import test from "node:test";
import {
  recordPaymentSchema,
  submitUpiPaymentSchema,
  rejectPaymentSubmissionSchema,
} from "../src/schemas/payment.schema";
import {
  createTechnicianSchema,
  updateTechnicianSchema,
} from "../src/schemas/user.schema";

test("payment verification schema allows booking service amount fallback", () => {
  const parsed = recordPaymentSchema.safeParse({
    paymentMode: "UPI",
    upiReference: "UPI123",
    paymentDate: "2026-06-14",
  });

  assert.equal(parsed.success, true);
});

test("UPI payment requires a UPI reference", () => {
  const parsed = recordPaymentSchema.safeParse({
    paymentMode: "UPI",
    paymentDate: "2026-06-14",
  });

  assert.equal(parsed.success, false);
});

test("customer payment submission validates transaction reference", () => {
  assert.equal(
    submitUpiPaymentSchema.safeParse({ upiReference: "TXN-123" }).success,
    true
  );
  assert.equal(
    submitUpiPaymentSchema.safeParse({ upiReference: "" }).success,
    false
  );
});

test("payment rejection reason is optional but bounded", () => {
  assert.equal(rejectPaymentSubmissionSchema.safeParse({}).success, true);
  assert.equal(
    rejectPaymentSubmissionSchema.safeParse({ reason: "x".repeat(501) })
      .success,
    false
  );
});

test("technician create and update schemas", () => {
  assert.equal(
    createTechnicianSchema.safeParse({
      fullName: "Tech One",
      email: "tech@example.com",
      phone: "+918428489046",
      password: "Password123",
    }).success,
    true
  );

  assert.equal(
    updateTechnicianSchema.safeParse({
      fullName: "Tech Two",
      isActive: false,
    }).success,
    true
  );
});
