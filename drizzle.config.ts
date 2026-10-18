import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Explicit DATABASE_URL in the shell wins; otherwise default to the local dev database.
config({ path: ".env.development.local" });
config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
