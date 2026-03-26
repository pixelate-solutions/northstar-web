CREATE TABLE "days" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"day_number" integer NOT NULL,
	"title" text NOT NULL,
	"location" text NOT NULL,
	"sleep_location" text,
	"drive_info" text,
	"notes" text,
	"cover_image_url" text,
	CONSTRAINT "days_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_id" integer NOT NULL,
	"title" text NOT NULL,
	"start_time" time,
	"end_time" time,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text,
	"location" text,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"tip" text,
	"cost" numeric(10, 2),
	"is_booked" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"is_booked" boolean DEFAULT false,
	"is_paid" boolean DEFAULT false,
	"purchase_date" date,
	"receipt_url" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_id" integer NOT NULL,
	"name" text NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"image_url" text,
	"tip" text,
	"google_maps_url" text
);
--> statement-breakpoint
CREATE TABLE "packing_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"is_packed" boolean DEFAULT false,
	"is_essential" boolean DEFAULT false,
	"day_specific" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"due_date" date,
	"is_done" boolean DEFAULT false,
	"priority" text DEFAULT 'medium' NOT NULL,
	"day_id" integer
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE set null ON UPDATE no action;