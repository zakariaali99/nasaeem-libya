CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anonymous_id" varchar(255) NOT NULL,
	"user_id" text,
	"session_id" varchar(255),
	"event_name" varchar(150) NOT NULL,
	"event_type" varchar(50) DEFAULT 'custom',
	"properties" json DEFAULT '{}'::json NOT NULL,
	"context" json,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anonymous_id" varchar(255) NOT NULL,
	"user_id" text,
	"linked_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_identities_anonymous_id_unique" UNIQUE("anonymous_id")
);
--> statement-breakpoint
CREATE TABLE "analytics_rfm_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"recency_window_days" integer DEFAULT 30 NOT NULL,
	"frequency_window_days" integer DEFAULT 90 NOT NULL,
	"monetary_window_days" integer DEFAULT 90 NOT NULL,
	"recency_scale" json DEFAULT '[]'::json NOT NULL,
	"frequency_scale" json DEFAULT '[]'::json NOT NULL,
	"monetary_scale" json DEFAULT '[]'::json NOT NULL,
	"weights" json DEFAULT '{"recency":1,"frequency":1,"monetary":1}'::json NOT NULL,
	"dimensions" json DEFAULT '[]'::json NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_rfm_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"config_id" uuid NOT NULL,
	"window_label" varchar(20) NOT NULL,
	"recency_score" integer NOT NULL,
	"frequency_score" integer NOT NULL,
	"monetary_score" integer NOT NULL,
	"total_score" integer NOT NULL,
	"segment" varchar(80) NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"last_order_at" timestamp,
	"recency_days" integer,
	"metrics" json DEFAULT '{}'::json NOT NULL,
	"dimensions" json,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"stale_after" timestamp
);
--> statement-breakpoint
ALTER TABLE "widgets" ADD COLUMN "style" json;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_identities" ADD CONSTRAINT "analytics_identities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rfm_configs" ADD CONSTRAINT "analytics_rfm_configs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rfm_configs" ADD CONSTRAINT "analytics_rfm_configs_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rfm_scores" ADD CONSTRAINT "analytics_rfm_scores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rfm_scores" ADD CONSTRAINT "analytics_rfm_scores_config_id_analytics_rfm_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."analytics_rfm_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytics_events_anonymous_id" ON "analytics_events" USING btree ("anonymous_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_user_id" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_event_name" ON "analytics_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_occurred_at" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_identities_user_id" ON "analytics_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_identities_last_seen_at" ON "analytics_identities" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_configs_active" ON "analytics_rfm_configs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_configs_updated_at" ON "analytics_rfm_configs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_scores_user_id" ON "analytics_rfm_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_scores_window_label" ON "analytics_rfm_scores" USING btree ("window_label");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_scores_config_id" ON "analytics_rfm_scores" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_scores_computed_at" ON "analytics_rfm_scores" USING btree ("computed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_analytics_rfm_scores_user_window_config" ON "analytics_rfm_scores" USING btree ("user_id","window_label","config_id");--> statement-breakpoint
CREATE INDEX "idx_categories_created_at" ON "categories" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_products_sku" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_products_price" ON "products" USING btree ("price");--> statement-breakpoint
CREATE INDEX "idx_products_created_at" ON "products" USING btree ("created_at");