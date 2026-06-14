import { userRepository } from "../repositories/user.repository";
import {
  generatePasswordResetToken,
  generateToken,
  hashPassword,
  comparePassword,
  verifyPasswordResetToken,
} from "../core/auth";
import { config } from "../core/config";
import { notificationService } from "./notification.service";
import type {
  ForgotPasswordInput,
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
} from "../schemas/auth.schema";
import type { User, SafeUser } from "../models/user";

// ── Result types (no HTTP leakage into service) ────
type RegisterSuccess = { ok: true; user: SafeUser; token: string };
type RegisterFailure = { ok: false; error: "EMAIL_EXISTS" };
type RegisterResult = RegisterSuccess | RegisterFailure;

type LoginSuccess = { ok: true; user: SafeUser; token: string };
type LoginFailure = { ok: false; error: "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" };
type LoginResult = LoginSuccess | LoginFailure;

type MeSuccess = { ok: true; user: SafeUser };
type MeFailure = { ok: false; error: "NOT_FOUND" | "ACCOUNT_INACTIVE" };
type MeResult = MeSuccess | MeFailure;

type ForgotPasswordSuccess = { ok: true; resetUrl?: string };
type ResetPasswordSuccess = { ok: true };
type ResetPasswordFailure = { ok: false; error: "INVALID_OR_EXPIRED_TOKEN" | "ACCOUNT_INACTIVE" };
type ResetPasswordResult = ResetPasswordSuccess | ResetPasswordFailure;

// ── Strip hashed_password before sending to client ─
function sanitize(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hashedPassword: _, ...safe } = user;
  return safe;
}

export class AuthService {
  // ── Register (CUSTOMER only) ─────────────────────
  async register(input: RegisterInput): Promise<RegisterResult> {
    const exists = await userRepository.emailExists(input.email);
    if (exists) {
      return { ok: false, error: "EMAIL_EXISTS" };
    }

    const hashed = await hashPassword(input.password);

    const user = await userRepository.create({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      hashedPassword: hashed,
      role: "CUSTOMER",
    });

    const token = generateToken(user);

    return { ok: true, user: sanitize(user), token };
  }

  // ── Login (any role) ─────────────────────────────
  async login(input: LoginInput): Promise<LoginResult> {
    const user = await userRepository.findByEmail(input.email);

    if (!user) {
      return { ok: false, error: "INVALID_CREDENTIALS" };
    }

    const passwordValid = await comparePassword(
      input.password,
      user.hashedPassword
    );

    if (!passwordValid) {
      return { ok: false, error: "INVALID_CREDENTIALS" };
    }

    if (!user.isActive) {
      return { ok: false, error: "ACCOUNT_INACTIVE" };
    }

    const token = generateToken(user);

    return { ok: true, user: sanitize(user), token };
  }

  async me(userId: string): Promise<MeResult> {
    const user = await userRepository.findById(userId);

    if (!user) {
      return { ok: false, error: "NOT_FOUND" };
    }

    if (!user.isActive) {
      return { ok: false, error: "ACCOUNT_INACTIVE" };
    }

    return { ok: true, user: sanitize(user) };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordSuccess> {
    const user = await userRepository.findByEmail(input.email);

    if (!user || !user.isActive) {
      return { ok: true };
    }

    const token = generatePasswordResetToken(user);
    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

    await notificationService.passwordReset(sanitize(user), resetUrl);

    return {
      ok: true,
      ...(config.NODE_ENV !== "production" ? { resetUrl } : {}),
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
    try {
      const payload = verifyPasswordResetToken(input.token);
      const user = await userRepository.findById(payload.sub);

      if (!user || user.email !== payload.email) {
        return { ok: false, error: "INVALID_OR_EXPIRED_TOKEN" };
      }

      if (!user.isActive) {
        return { ok: false, error: "ACCOUNT_INACTIVE" };
      }

      const hashed = await hashPassword(input.password);
      await userRepository.updatePassword(user.id, hashed);

      return { ok: true };
    } catch {
      return { ok: false, error: "INVALID_OR_EXPIRED_TOKEN" };
    }
  }
}

export const authService = new AuthService();
