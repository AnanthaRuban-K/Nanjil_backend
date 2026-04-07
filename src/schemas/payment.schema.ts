import { z } from "zod";

// ── Record payment (ADMIN only) ────────────────────
export const recordPaymentSchema = z
  .object({
    amount: z
      .number()
      .positive("Amount must be greater than zero")
      .max(99999999.99, "Amount exceeds maximum"),

    paymentMode: z.enum(["CASH", "UPI"], {
      errorMap: () => ({ message: "Payment mode must be CASH or UPI" }),
    }),

    upiReference: z
      .string()
      .trim()
      .min(1, "UPI reference cannot be empty")
      .max(100, "UPI reference must be at most 100 characters")
      .optional(),

    paymentDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
      .refine(
        (val) => !isNaN(Date.parse(val)),
        "Must be a valid calendar date"
      ),
  })
  .refine(
    (data) => {
      if (data.paymentMode === "UPI") {
        return !!data.upiReference && data.upiReference.length > 0;
      }
      return true;
    },
    {
      message: "UPI reference is required when payment mode is UPI",
      path: ["upiReference"],
    }
  );

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;