import { z } from "zod";

// ── Revenue date-range filter ──────────────────────
export const revenueFilterSchema = z
  .object({
    date_from: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date_from must be YYYY-MM-DD"),

    date_to: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date_to must be YYYY-MM-DD"),
  })
  .refine(
    (data) => {
      const from = new Date(data.date_from);
      const to = new Date(data.date_to);
      return !isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to;
    },
    {
      message: "date_from must be a valid date before or equal to date_to",
      path: ["date_from"],
    }
  );

export type RevenueFilterInput = z.infer<typeof revenueFilterSchema>;