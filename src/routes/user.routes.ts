import { Hono } from "hono";
import { authMiddleware, roleMiddleware, type AppEnv } from "../core/middleware";
import { hashPassword } from "../core/auth";
import { userRepository } from "../repositories/user.repository";
import {
  createAdminSchema,
  createTechnicianSchema,
  updateAdminSchema,
  updateTechnicianSchema,
} from "../schemas/user.schema";
import { uuidParamSchema } from "../schemas/booking.schema";

const adminUserRoutes = new Hono<AppEnv>();

adminUserRoutes.use("*", authMiddleware);
adminUserRoutes.use("*", roleMiddleware("ADMIN"));

adminUserRoutes.get("/technicians", async (c) => {
  const includeInactive = c.req.query("includeInactive") === "true";
  const technicians = await userRepository.findTechnicians(includeInactive);

  return c.json({
    success: true,
    data: technicians,
  });
});

adminUserRoutes.post("/technicians", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ success: false, message: "Request body must be valid JSON" }, 400);
  }

  const parsed = createTechnicianSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  if (await userRepository.emailExists(parsed.data.email)) {
    return c.json({ success: false, message: "Email is already registered" }, 409);
  }

  const user = await userRepository.create({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    hashedPassword: await hashPassword(parsed.data.password),
    role: "TECHNICIAN",
  });
  const { hashedPassword: _, ...safe } = user;

  return c.json(
    { success: true, message: "Technician created", data: safe },
    201
  );
});

adminUserRoutes.get("/admins", async (c) => {
  const includeInactive = c.req.query("includeInactive") === "true";
  const admins = await userRepository.findAdmins(includeInactive);

  return c.json({
    success: true,
    data: admins,
  });
});

adminUserRoutes.post("/admins", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ success: false, message: "Request body must be valid JSON" }, 400);
  }

  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  if (await userRepository.emailExists(parsed.data.email)) {
    return c.json({ success: false, message: "Email is already registered" }, 409);
  }

  const user = await userRepository.create({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    hashedPassword: await hashPassword(parsed.data.password),
    role: "ADMIN",
  });
  const { hashedPassword: _, ...safe } = user;

  return c.json(
    { success: true, message: "Admin created", data: safe },
    201
  );
});

adminUserRoutes.patch("/admins/:id", async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return c.json({ success: false, message: "Invalid admin ID format" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ success: false, message: "Request body must be valid JSON" }, 400);
  }

  const parsed = updateAdminSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  if (id === currentUser.sub && parsed.data.isActive === false) {
    return c.json(
      { success: false, message: "You cannot deactivate your own admin account" },
      400
    );
  }

  const updated = await userRepository.updateAdmin(id, {
    ...parsed.data,
    ...(parsed.data.password
      ? { hashedPassword: await hashPassword(parsed.data.password) }
      : {}),
  });

  if (!updated) {
    return c.json({ success: false, message: "Admin not found" }, 404);
  }

  return c.json({ success: true, message: "Admin updated", data: updated });
});

adminUserRoutes.patch("/technicians/:id", async (c) => {
  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return c.json({ success: false, message: "Invalid technician ID format" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ success: false, message: "Request body must be valid JSON" }, 400);
  }

  const parsed = updateTechnicianSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        data: parsed.error.flatten().fieldErrors,
      },
      422
    );
  }

  const updated = await userRepository.updateTechnician(id, {
    ...parsed.data,
    ...(parsed.data.password
      ? { hashedPassword: await hashPassword(parsed.data.password) }
      : {}),
  });

  if (!updated) {
    return c.json({ success: false, message: "Technician not found" }, 404);
  }

  return c.json({ success: true, message: "Technician updated", data: updated });
});

export { adminUserRoutes };
