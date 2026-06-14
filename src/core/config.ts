import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid postgres:// URL"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:4001"),
  COOKIE_DOMAIN: z.string().optional(),
  FRONTEND_URL: z.string().url().default("http://localhost:4001"),
  ADMIN_EMAILS: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌  Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config = Object.freeze(parsed.data);
export type Config = typeof config;
