CREATE TABLE IF NOT EXISTS "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"has_lifetime_access" boolean DEFAULT false NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"stripe_customer_id" text,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"active_trip_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"name" text NOT NULL,
	"destination" text,
	"summary" text,
	"cover_image_url" text,
	"template_key" text,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "days" DROP CONSTRAINT IF EXISTS "days_date_unique";
--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN IF NOT EXISTS "trip_id" integer;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "trip_id" integer;
--> statement-breakpoint
ALTER TABLE "packing_items" ADD COLUMN IF NOT EXISTS "trip_id" integer;
--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "trip_id" integer;
--> statement-breakpoint
INSERT INTO "app_users" (
	"clerk_user_id",
	"email",
	"full_name",
	"has_lifetime_access",
	"onboarding_completed"
)
VALUES (
	'legacy-import-user',
	'legacy-import@northstar.local',
	'Legacy Imported Workspace',
	true,
	true
)
ON CONFLICT ("clerk_user_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "trips" (
	"owner_id",
	"name",
	"destination",
	"summary",
	"template_key",
	"start_date",
	"end_date"
)
SELECT
	u."id",
	'Imported Southwest Trip',
	'Southwest U.S. Road Trip',
	'Migrated from the original single-trip version of the app.',
	'legacy-import',
	(SELECT MIN("date") FROM "days"),
	(SELECT MAX("date") FROM "days")
FROM "app_users" u
WHERE u."clerk_user_id" = 'legacy-import-user'
AND NOT EXISTS (
	SELECT 1
	FROM "trips" t
	WHERE t."owner_id" = u."id"
	AND t."template_key" = 'legacy-import'
);
--> statement-breakpoint
UPDATE "days"
SET "trip_id" = (
	SELECT "id"
	FROM "trips"
	WHERE "template_key" = 'legacy-import'
	ORDER BY "id"
	LIMIT 1
)
WHERE "trip_id" IS NULL;
--> statement-breakpoint
UPDATE "expenses"
SET "trip_id" = (
	SELECT "id"
	FROM "trips"
	WHERE "template_key" = 'legacy-import'
	ORDER BY "id"
	LIMIT 1
)
WHERE "trip_id" IS NULL;
--> statement-breakpoint
UPDATE "packing_items"
SET "trip_id" = (
	SELECT "id"
	FROM "trips"
	WHERE "template_key" = 'legacy-import'
	ORDER BY "id"
	LIMIT 1
)
WHERE "trip_id" IS NULL;
--> statement-breakpoint
UPDATE "reminders"
SET "trip_id" = (
	SELECT "id"
	FROM "trips"
	WHERE "template_key" = 'legacy-import'
	ORDER BY "id"
	LIMIT 1
)
WHERE "trip_id" IS NULL;
--> statement-breakpoint
UPDATE "app_users"
SET "active_trip_id" = (
	SELECT "id"
	FROM "trips"
	WHERE "template_key" = 'legacy-import'
	ORDER BY "id"
	LIMIT 1
)
WHERE "clerk_user_id" = 'legacy-import-user'
AND "active_trip_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "days" ALTER COLUMN "trip_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "trip_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "packing_items" ALTER COLUMN "trip_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "reminders" ALTER COLUMN "trip_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "trips"
	ADD CONSTRAINT "trips_owner_id_app_users_id_fk"
	FOREIGN KEY ("owner_id")
	REFERENCES "public"."app_users"("id")
	ON DELETE cascade
	ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "days"
	ADD CONSTRAINT "days_trip_id_trips_id_fk"
	FOREIGN KEY ("trip_id")
	REFERENCES "public"."trips"("id")
	ON DELETE cascade
	ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "expenses"
	ADD CONSTRAINT "expenses_trip_id_trips_id_fk"
	FOREIGN KEY ("trip_id")
	REFERENCES "public"."trips"("id")
	ON DELETE cascade
	ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "packing_items"
	ADD CONSTRAINT "packing_items_trip_id_trips_id_fk"
	FOREIGN KEY ("trip_id")
	REFERENCES "public"."trips"("id")
	ON DELETE cascade
	ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "packing_items"
	ADD CONSTRAINT "packing_items_day_specific_days_id_fk"
	FOREIGN KEY ("day_specific")
	REFERENCES "public"."days"("id")
	ON DELETE set null
	ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "reminders"
	ADD CONSTRAINT "reminders_trip_id_trips_id_fk"
	FOREIGN KEY ("trip_id")
	REFERENCES "public"."trips"("id")
	ON DELETE cascade
	ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_users_clerk_user_id_idx" ON "app_users" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_users_active_trip_id_idx" ON "app_users" USING btree ("active_trip_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_owner_id_idx" ON "trips" USING btree ("owner_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "days_trip_id_date_idx" ON "days" USING btree ("trip_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "days_trip_id_day_number_idx" ON "days" USING btree ("trip_id","day_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_trip_id_idx" ON "expenses" USING btree ("trip_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "packing_items_trip_id_idx" ON "packing_items" USING btree ("trip_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminders_trip_id_idx" ON "reminders" USING btree ("trip_id");
