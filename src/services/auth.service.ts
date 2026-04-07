import { userRepository } from "../repositories/user.repository";
import { generateToken, hashPassword, comparePassword } from "../core/auth";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema";
import type { User, SafeUser } from "../models/user";

// ── Result types (no HTTP leakage into service) ────
type RegisterSuccess = { ok: true; user: SafeUser; token: string };
type RegisterFailure = { ok: false; error: "EMAIL_EXISTS" };
type RegisterResult = RegisterSuccess | RegisterFailure;

type LoginSuccess = { ok: true; user: SafeUser; token: string };
type LoginFailure = { ok: false; error: "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" };
type LoginResult = LoginSuccess | LoginFailure;

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
}

export const authService = new AuthService();