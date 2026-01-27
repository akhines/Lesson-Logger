import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if a user with this email already exists (possibly with different ID)
    if (userData.email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail && existingByEmail.id !== userData.id) {
        // Update the existing user's ID and other fields
        const [updatedUser] = await db
          .update(users)
          .set({
            id: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email))
          .returning();
        return updatedUser;
      }
    }
    
    // Check if user already exists to determine if this is a new signup
    const [existingUser] = await db.select().from(users).where(eq(users.id, userData.id!));
    
    // Set trial dates for new users (7-day trial)
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Normal upsert by ID - but preserve isAdmin and trial dates if user exists
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        // Set trial dates only for new users
        trialStartDate: existingUser?.trialStartDate || trialStartDate,
        trialEndDate: existingUser?.trialEndDate || trialEndDate,
        subscriptionPlan: existingUser?.subscriptionPlan || "trial",
        subscriptionStatus: existingUser?.subscriptionStatus || "active",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
          // Preserve existing isAdmin, trial, and subscription status
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
