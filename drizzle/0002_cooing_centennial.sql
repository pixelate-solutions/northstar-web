CREATE TABLE "ai_action_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"conversation_id" integer,
	"message_id" integer,
	"action_type" text NOT NULL,
	"summary" text NOT NULL,
	"details_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"conversation_id" integer,
	"message_id" integer,
	"approval_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"payload_json" text,
	"external_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"cards_json" text,
	"followups_json" text,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"reservation_id" integer,
	"category" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"offer_id" text,
	"title" text NOT NULL,
	"total_amount" numeric(10, 2),
	"currency" text,
	"external_url" text,
	"payload_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_search_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"category" text NOT NULL,
	"provider" text NOT NULL,
	"query_text" text NOT NULL,
	"results_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"account_email" text,
	"external_account_id" text,
	"scopes" text,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"expires_at" timestamp,
	"metadata_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"connected_account_id" integer NOT NULL,
	"resource" text NOT NULL,
	"cursor" text,
	"last_synced_at" timestamp,
	"metadata_json" text
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"provider_name" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"confirmation_code" text,
	"start_at" timestamp,
	"end_at" timestamp,
	"time_zone" text,
	"location" text,
	"price_total" numeric(10, 2),
	"currency" text,
	"details_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traveler_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"birth_date" date,
	"preferences_json" text,
	"loyalty_programs_json" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_approvals" ADD CONSTRAINT "ai_approvals_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_approvals" ADD CONSTRAINT "ai_approvals_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_approvals" ADD CONSTRAINT "ai_approvals_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_approvals" ADD CONSTRAINT "ai_approvals_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_search_results" ADD CONSTRAINT "booking_search_results_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_search_results" ADD CONSTRAINT "booking_search_results_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_states" ADD CONSTRAINT "integration_sync_states_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traveler_profiles" ADD CONSTRAINT "traveler_profiles_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_action_logs_trip_id_idx" ON "ai_action_logs" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "ai_approvals_trip_id_idx" ON "ai_approvals" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "ai_approvals_status_idx" ON "ai_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_trip_id_idx" ON "ai_conversations" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "booking_orders_trip_id_idx" ON "booking_orders" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "booking_search_results_trip_id_idx" ON "booking_search_results" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "connected_accounts_user_provider_idx" ON "connected_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_sync_states_account_resource_idx" ON "integration_sync_states" USING btree ("connected_account_id","resource");--> statement-breakpoint
CREATE INDEX "reservations_trip_id_idx" ON "reservations" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "reservations_source_idx" ON "reservations" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "traveler_profiles_user_id_idx" ON "traveler_profiles" USING btree ("user_id");