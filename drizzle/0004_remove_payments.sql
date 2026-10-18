ALTER TABLE "app_users" DROP COLUMN IF EXISTS "has_lifetime_access";--> statement-breakpoint
ALTER TABLE "app_users" DROP COLUMN IF EXISTS "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "app_users" DROP COLUMN IF EXISTS "stripe_checkout_session_id";--> statement-breakpoint
ALTER TABLE "app_users" DROP COLUMN IF EXISTS "stripe_payment_intent_id";