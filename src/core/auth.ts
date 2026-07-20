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
  ver: number;
}

export interface PasswordResetPayload {
  sub: string;
  email: string;
  purpose: "PASSWORD_RESET";
  ver: number;
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
    ver: user.tokenVersion,
  };

  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.JWT_SECRET);
  if (
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.is_active !== "boolean" ||
    !Number.isInteger(payload.ver)
  ) {
    throw new Error("Invalid access token payload");
  }
  return payload as TokenPayload;
}

export function generatePasswordResetToken(user: User): string {
  const payload: PasswordResetPayload = {
    sub: user.id,
    email: user.email,
    purpose: "PASSWORD_RESET",
    ver: user.tokenVersion,
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: PASSWORD_RESET_EXPIRY,
  });
}

export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as PasswordResetPayload;

  if (
    payload.purpose !== "PASSWORD_RESET" ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    !Number.isInteger(payload.ver)
  ) {
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
