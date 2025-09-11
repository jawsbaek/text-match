import { eq } from "drizzle-orm";
import { db } from "./index";
import { role, service } from "./schema";

/**
 * Seed script for bootstrap data
 * Creates minimal required data for the application to function
 */
export async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Create bootstrap service
    const existingService = await db
      .select()
      .from(service)
      .where(eq(service.code, "bootstrap"))
      .limit(1);

    if (existingService.length === 0) {
      await db.insert(service).values({
        id: "bootstrap-service",
        code: "bootstrap",
        name: "Bootstrap Service",
        owners: ["admin@local"],
      });
      console.log("✅ Created bootstrap service");
    } else {
      console.log("ℹ️  Bootstrap service already exists");
    }

    // Create default roles
    const defaultRoles = [
      {
        id: "admin-role",
        name: "Admin",
        description: "Full system access",
      },
      {
        id: "owner-role",
        name: "Owner",
        description: "Service owner with full access to their services",
      },
      {
        id: "editor-role",
        name: "Editor",
        description: "Can edit keys and translations",
      },
      {
        id: "reviewer-role",
        name: "Reviewer",
        description: "Can review and approve translations",
      },
      {
        id: "viewer-role",
        name: "Viewer",
        description: "Read-only access to translations",
      },
    ];

    for (const roleData of defaultRoles) {
      const existingRole = await db
        .select()
        .from(role)
        .where(eq(role.name, roleData.name))
        .limit(1);

      if (existingRole.length === 0) {
        await db.insert(role).values(roleData);
        console.log(`✅ Created role: ${roleData.name}`);
      } else {
        console.log(`ℹ️  Role ${roleData.name} already exists`);
      }
    }

    console.log("🎉 Database seed completed successfully!");
  } catch (error) {
    console.error("❌ Error during seed:", error);
    throw error;
  }
}

// Allow direct execution
if (import.meta.main) {
  await seed();
  process.exit(0);
}
