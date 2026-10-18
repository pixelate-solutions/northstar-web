import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let localDb: Database | null = null;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function isLocalDatabase(databaseUrl: string) {
  return /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(databaseUrl) || databaseUrl.startsWith("postgres:///");
}

export function getDb(): Database | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return null;
  }

  // Local development and tests run against a plain Postgres copy instead of Neon.
  if (isLocalDatabase(databaseUrl)) {
    localDb ??= drizzlePg(new Pool({ connectionString: databaseUrl }), { schema }) as unknown as Database;
    return localDb;
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}
