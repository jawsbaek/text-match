import { neon } from "@netlify/neon";
import { serverOnly } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "~/env/server";

import * as schema from "~/lib/db/schema";

const getDatabase = serverOnly(() => {
  // Use regular PostgreSQL for local development
  if (env.DATABASE_URL) {
    const driver = postgres(env.DATABASE_URL);
    return drizzlePostgres({ client: driver, schema, casing: "snake_case" });
  }

  const driver = neon();
  return drizzle(driver, { schema, casing: "snake_case" });

  throw new Error(
    "No database URL configured. Set either NETLIFY_DATABASE_URL or DATABASE_URL",
  );
});

export const db = getDatabase();
