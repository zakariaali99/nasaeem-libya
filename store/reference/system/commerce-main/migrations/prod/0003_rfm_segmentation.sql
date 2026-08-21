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
ALTER TABLE "analytics_rfm_configs" ADD CONSTRAINT "analytics_rfm_configs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rfm_configs" ADD CONSTRAINT "analytics_rfm_configs_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rfm_scores" ADD CONSTRAINT "analytics_rfm_scores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_rfm_scores" ADD CONSTRAINT "analytics_rfm_scores_config_id_analytics_rfm_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "analytics_rfm_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_configs_active" ON "analytics_rfm_configs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_configs_updated_at" ON "analytics_rfm_configs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_scores_user_id" ON "analytics_rfm_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_scores_window_label" ON "analytics_rfm_scores" USING btree ("window_label");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_scores_config_id" ON "analytics_rfm_scores" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_rfm_scores_computed_at" ON "analytics_rfm_scores" USING btree ("computed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_analytics_rfm_scores_user_window_config" ON "analytics_rfm_scores" USING btree ("user_id","window_label","config_id");--> statement-breakpoint
INSERT INTO "analytics_rfm_configs" (
  "name",
  "description",
  "is_active",
  "recency_window_days",
  "frequency_window_days",
  "monetary_window_days",
  "recency_scale",
  "frequency_scale",
  "monetary_scale",
  "weights",
  "dimensions",
  "created_at",
  "updated_at"
) VALUES (
  'الإعداد الافتراضي',
  'إعداد افتراضي لنموذج RFM مع نوافذ 30/90 يوماً',
  true,
  30,
  90,
  90,
  '[{"min":0,"max":7,"score":5},{"min":8,"max":14,"score":4},{"min":15,"max":30,"score":3},{"min":31,"max":60,"score":2},{"min":61,"score":1}]',
  '[{"min":0,"max":1,"score":1},{"min":2,"max":3,"score":2},{"min":4,"max":5,"score":3},{"min":6,"max":9,"score":4},{"min":10,"score":5}]',
  '[{"min":0,"max":100,"score":1},{"min":100,"max":300,"score":2},{"min":300,"max":800,"score":3},{"min":800,"max":1500,"score":4},{"min":1500,"score":5}]',
  '{"recency":0.4,"frequency":0.3,"monetary":0.3}',
  '[]',
  now(),
  now()
) ON CONFLICT DO NOTHING;
