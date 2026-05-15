import "dotenv/config";
import { db } from "../src/db";
import { user, account } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "@node-rs/bcrypt";

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@novatech.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";
  const adminName = process.env.ADMIN_NAME || "Administrator";

  console.log("🌱 Seeding admin user...");
  console.log(`📧 Email: ${adminEmail}`);

  try {
    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(user)
      .where(eq(user.email, adminEmail))
      .limit(1);

    if (existingUsers.length > 0) {
      console.log("👤 User already exists, updating role to admin...");

      // Update existing user to admin role
      await db
        .update(user)
        .set({
          role: "admin",
          updatedAt: new Date(),
        })
        .where(eq(user.email, adminEmail));

      console.log("✅ User role updated to admin successfully!");
    } else {
      console.log("👤 Creating new admin user...");

      const now = new Date();
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Hash password using bcrypt (Better Auth uses @node-rs/bcrypt)
      const hashedPassword = await hash(adminPassword, 10);

      // Create user
      await db.insert(user).values({
        id: userId,
        name: adminName,
        email: adminEmail,
        emailVerified: true,
        role: "admin",
        image: null,
        createdAt: now,
        updatedAt: now,
      });

      // Create email/password account with hashed password
      await db.insert(account).values({
        id: `account_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        accountId: adminEmail,
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        createdAt: now,
        updatedAt: now,
      });

      console.log("✅ Admin user created successfully!");
    }

    console.log("\n📝 Admin credentials:");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log("\n⚠️  IMPORTANT: Change the password after first login!");
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seedAdmin();
