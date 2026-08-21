CREATE TABLE IF NOT EXISTS "analytics_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anonymous_id" varchar(255) NOT NULL UNIQUE,
  "user_id" text REFERENCES "user"("id") ON DELETE CASCADE,
  "linked_at" timestamp,
  "last_seen_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_identities_user_id" ON "analytics_identities" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_identities_last_seen_at" ON "analytics_identities" ("last_seen_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anonymous_id" varchar(255) NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE CASCADE,
  "session_id" varchar(255),
  "event_name" varchar(150) NOT NULL,
  "event_type" varchar(50) DEFAULT 'custom',
  "properties" json NOT NULL DEFAULT '{}'::json,
  "context" json,
  "occurred_at" timestamp NOT NULL DEFAULT now(),
  "received_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_anonymous_id" ON "analytics_events" ("anonymous_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_user_id" ON "analytics_events" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_event_name" ON "analytics_events" ("event_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analytics_events_occurred_at" ON "analytics_events" ("occurred_at");
