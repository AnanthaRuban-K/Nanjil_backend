import assert from "node:assert/strict";
import test from "node:test";
import {
  canAdminTransition,
  canTechnicianTransition,
} from "../src/services/booking.service";

test("admin booking status transitions", () => {
  assert.equal(canAdminTransition("PENDING", "CANCELLED"), true);
  assert.equal(canAdminTransition("CONFIRMED", "IN_PROGRESS"), true);
  assert.equal(canAdminTransition("IN_PROGRESS", "COMPLETED"), true);
  assert.equal(canAdminTransition("PENDING", "COMPLETED"), false);
  assert.equal(canAdminTransition("COMPLETED", "CANCELLED"), false);
});

test("technician booking status transitions", () => {
  assert.equal(canTechnicianTransition("CONFIRMED", "IN_PROGRESS"), true);
  assert.equal(canTechnicianTransition("IN_PROGRESS", "COMPLETED"), true);
  assert.equal(canTechnicianTransition("PENDING", "IN_PROGRESS"), false);
  assert.equal(canTechnicianTransition("COMPLETED", "IN_PROGRESS"), false);
});
