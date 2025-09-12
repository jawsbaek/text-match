import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "~/lib/db/schema";

// Test database connection management
let testClient: postgres.Sql | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

export function getTestDb() {
  if (!testDb) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required for tests");
    }

    // Create postgres client with connection pool settings for tests
    testClient = postgres(databaseUrl, {
      max: 5, // Smaller connection pool for tests
      idle_timeout: 20, // Close idle connections faster
      connect_timeout: 10,
    });

    testDb = drizzle({ client: testClient, schema, casing: "snake_case" });
  }

  return testDb;
}

export async function closeTestDb(): Promise<void> {
  if (testClient) {
    await testClient.end();
    testClient = null;
    testDb = null;
  }
}

// Global test teardown
if (typeof globalThis !== "undefined") {
  // Ensure connections are closed when process exits
  process.on("exit", () => {
    if (testClient) {
      // Synchronous close for process exit
      testClient.end({ timeout: 0 });
    }
  });

  process.on("SIGINT", async () => {
    await closeTestDb();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await closeTestDb();
    process.exit(0);
  });
}
