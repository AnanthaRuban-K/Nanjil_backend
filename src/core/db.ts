import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "./config";

// ── Import ALL schemas so Drizzle knows every table ─
import * as userSchema from "../models/user";
import * as bookingSchema from "../models/booking";
import * as bookingStatusLogSchema from "../models/booking-status-log";
import * as paymentSchema from "../models/payment";

// ── Connection pool ────────────────────────────────
const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("⚠️  Unexpected PG pool error:", err.message);
});

// ── Drizzle instance (schema-aware) ────────────────
export const db = drizzle(pool, {
  schema: {
    ...userSchema,
    ...bookingSchema,
    ...bookingStatusLogSchema,
    ...paymentSchema,
  },
});

// ── Healthcheck helper ─────────────────────────────
export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT NOW()");
    console.log(
      `✅  Database connected  –  server time: ${result.rows[0].now}`
    );
  } finally {
    client.release();
  }
}

// ── Graceful shutdown ──────────────────────────────
export async function closeConnection(): Promise<void> {
  await pool.end();
  console.log("🔌  Database pool closed");
}