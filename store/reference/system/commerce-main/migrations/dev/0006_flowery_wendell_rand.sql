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
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_identities" ADD CONSTRAINT "analytics_identities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytics_events_anonymous_id" ON "analytics_events" USING btree ("anonymous_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_user_id" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_event_name" ON "analytics_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "idx_analytics_events_occurred_at" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_identities_user_id" ON "analytics_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_identities_last_seen_at" ON "analytics_identities" USING btree ("last_seen_at");