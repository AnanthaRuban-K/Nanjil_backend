import { z } from "zod";

export const createTechnicianSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(15)
    .regex(/^\+?[0-9]+$/),
  password: z.string().min(8).max(100),
});

export const createAdminSchema = createTechnicianSchema;

export const updateTechnicianSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(15)
    .regex(/^\+?[0-9]+$/)
    .optional(),
  password: z.string().min(8).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const updateAdminSchema = updateTechnicianSchema;

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
