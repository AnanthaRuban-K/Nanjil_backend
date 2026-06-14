import { and, asc, eq } from "drizzle-orm";
import { db } from "../core/db";
import {
  users,
  type User,
  type NewUser,
  type SafeUser,
  type UserRole,
} from "../models/user";
import type { UpdateAdminInput, UpdateTechnicianInput } from "../schemas/user.schema";

export class UserRepository {
  /** Find a single user by email (returns undefined when not found) */
  async findByEmail(email: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return rows[0];
  }

  /** Find a single user by primary key */
  async findById(id: string): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows[0];
  }

  /** Insert a new user and return the full row */
  async create(data: NewUser): Promise<User> {
    const rows = await db.insert(users).values(data).returning();
    return rows[0];
  }

  /** Check if any user with the given email exists */
  async emailExists(email: string): Promise<boolean> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return rows.length > 0;
  }

  async findTechnicians(includeInactive = false): Promise<SafeUser[]> {
    return this.findByRole("TECHNICIAN", includeInactive);
  }

  async findAdmins(includeInactive = false): Promise<SafeUser[]> {
    return this.findByRole("ADMIN", includeInactive);
  }

  private async findByRole(role: UserRole, includeInactive = false): Promise<SafeUser[]> {
    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        includeInactive
          ? eq(users.role, role)
          : and(eq(users.role, role), eq(users.isActive, true))
      )
      .orderBy(asc(users.fullName));

    return rows;
  }

  async findActiveTechnicians(): Promise<SafeUser[]> {
    return this.findTechnicians(false);
  }

  async updateTechnician(
    id: string,
    data: UpdateTechnicianInput & { hashedPassword?: string }
  ): Promise<SafeUser | undefined> {
    return this.updateByRole(id, "TECHNICIAN", data);
  }

  async updateAdmin(
    id: string,
    data: UpdateAdminInput & { hashedPassword?: string }
  ): Promise<SafeUser | undefined> {
    return this.updateByRole(id, "ADMIN", data);
  }

  private async updateByRole(
    id: string,
    role: UserRole,
    data: (UpdateTechnicianInput | UpdateAdminInput) & { hashedPassword?: string }
  ): Promise<SafeUser | undefined> {
    const rows = await db
      .update(users)
      .set({
        ...(data.fullName ? { fullName: data.fullName } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(typeof data.isActive === "boolean"
          ? { isActive: data.isActive }
          : {}),
        ...(data.hashedPassword
          ? { hashedPassword: data.hashedPassword }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.role, role)))
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return rows[0];
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const rows = await db
      .update(users)
      .set({
        hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return rows[0];
  }
}

// Singleton – reused across the application
export const userRepository = new UserRepository();
