import { eq } from "drizzle-orm";
import { db } from "../core/db";
import { users, type User, type NewUser } from "../models/user";

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
}

// Singleton – reused across the application
export const userRepository = new UserRepository();