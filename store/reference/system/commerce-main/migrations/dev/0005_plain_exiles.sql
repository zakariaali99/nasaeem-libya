DROP INDEX IF EXISTS "idx_active_carts";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_notifications_unread";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_orders_notes_search";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_product_reviews_search";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_products_search";--> statement-breakpoint
ALTER TABLE "widgets" ADD COLUMN "style" json;