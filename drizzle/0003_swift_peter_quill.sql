CREATE TABLE "trip_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"added_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_memberships" ADD CONSTRAINT "trip_memberships_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_memberships" ADD CONSTRAINT "trip_memberships_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_memberships" ADD CONSTRAINT "trip_memberships_added_by_user_id_app_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_memberships_trip_id_idx" ON "trip_memberships" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_memberships_user_id_idx" ON "trip_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_memberships_trip_id_user_id_idx" ON "trip_memberships" USING btree ("trip_id","user_id");