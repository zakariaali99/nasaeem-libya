ALTER TABLE "order_items" RENAME COLUMN "discounted_price" TO "discount_amount";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_total" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_title" varchar(255);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "discount_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE no action ON UPDATE no action;