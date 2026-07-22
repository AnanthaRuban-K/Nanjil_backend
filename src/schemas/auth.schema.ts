import { z } from "zod";

// ── Register (CUSTOMER only) ───────────────────────
export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),

  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase(),

  phone: z
    .string()
    .trim()
    .min(10, "Phone must be at least 10 digits")
    .max(15, "Phone must be at most 15 digits")
    .regex(/^\+?[0-9]+$/, "Phone must contain only digits (optional leading +)"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ── Login (any role) ───────────────────────────────
const loginIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Email or phone number is required")
  .max(255, "Email or phone number is too long")
  .transform((value) =>
    value.includes("@")
      ? value.toLowerCase()
      : value.replace(/[\s()-]/g, "")
  )
  .refine(
    (value) =>
      z.string().email().safeParse(value).success ||
      /^\+?[0-9]{10,15}$/.test(value),
    "Enter a valid email or phone number"
  );

const loginPasswordSchema = z.string().min(1, "Password is required");

export const loginSchema = z
  .union([
    z.object({
      identifier: loginIdentifierSchema,
      password: loginPasswordSchema,
    }),
    // Keep older clients that still send the field as `email` working.
    z.object({
      email: z.string().trim().email("Invalid email address").toLowerCase(),
      password: loginPasswordSchema,
    }),
  ])
  .transform((input) => ({
    identifier: "identifier" in input ? input.identifier : input.email,
    password: input.password,
  }));

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
