ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "delivery_fee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN IF NOT EXISTS "customer_segment" varchar(150);