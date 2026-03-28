import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";
import { createTrip } from "@/lib/trips";

config({ path: ".env.local" });

async function seed() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required before seeding.");
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  console.log("Seeding Northstar demo workspace...");

  await db.delete(schema.appUsers);

  const [demoUser] = await db
    .insert(schema.appUsers)
    .values({
      clerkUserId: "demo-seed-user",
      email: "demo@northstar.local",
      fullName: "Northstar Demo User",
      hasLifetimeAccess: true,
      onboardingCompleted: true,
    })
    .returning();

  if (!demoUser) {
    throw new Error("Unable to create demo user.");
  }

  await createTrip({
    user: demoUser,
    name: "Demo Trip",
  });

  console.log("Seed complete.");
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
