ALTER TABLE "partner_apps" ADD COLUMN "mode" varchar(20) DEFAULT 'test' NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;