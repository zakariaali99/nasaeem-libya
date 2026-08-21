ALTER TABLE "partner_apps" ADD COLUMN "settled_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "reserved_stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "reserved_stock" integer DEFAULT 0 NOT NULL;