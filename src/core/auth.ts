import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config";
import type { User } from "../models/user";

// ── Token payload shape ────────────────────────────
export interface TokenPayload {
  sub: string;       // user id
  role: string;
  email: string;
  is_active: boolean;
}

export interface PasswordResetPayload {
  sub: string;
  email: string;
  purpose: "PASSWORD_RESET";
}

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = "24h";
const PASSWORD_RESET_EXPIRY = "15m";

// ── JWT helpers ────────────────────────────────────
export function generateToken(user: User): string {
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    is_active: user.isActive,
  };

  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
}

export function generatePasswordResetToken(user: User): string {
  const payload: PasswordResetPayload = {
    sub: user.id,
    email: user.email,
    purpose: "PASSWORD_RESET",
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: PASSWORD_RESET_EXPIRY,
  });
}

export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as PasswordResetPayload;

  if (payload.purpose !== "PASSWORD_RESET") {
    throw new Error("Invalid token purpose");
  }

  return payload;
}

// ── Password helpers ───────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
