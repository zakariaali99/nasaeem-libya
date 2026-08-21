ALTER TABLE "orders" ADD COLUMN "wallet_amount_used" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "reserved_stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "reserved_stock" integer DEFAULT 0 NOT NULL;