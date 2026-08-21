CREATE TABLE "storefront_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_global_active" boolean DEFAULT false NOT NULL,
	"active_start_date" timestamp,
	"active_end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "widgets" ADD COLUMN "layout_id" uuid;--> statement-breakpoint
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_layout_id_storefront_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."storefront_layouts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "storefront_layouts" (name, is_global_active) VALUES ('التخطيط الافتراضي', true);
--> statement-breakpoint
UPDATE "widgets" SET "layout_id" = (SELECT id FROM "storefront_layouts" WHERE "is_global_active" = true LIMIT 1);