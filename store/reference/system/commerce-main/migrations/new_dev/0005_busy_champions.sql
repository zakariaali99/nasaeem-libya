CREATE TABLE "partner_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"api_key_id" varchar(64) NOT NULL,
	"api_secret_hash" char(64) NOT NULL,
	"allowed_ips" json,
	"webhook_secret_hash" char(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"rotated_at" timestamp,
	CONSTRAINT "partner_apps_api_key_id_unique" UNIQUE("api_key_id")
);
--> statement-breakpoint
CREATE TABLE "partner_request_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" char(64) NOT NULL,
	"response_code" integer NOT NULL,
	"response_body" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_id" varchar(128),
	"ip" varchar(45),
	"user_agent" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"issuer_type" varchar(20) NOT NULL,
	"issuer_id" uuid,
	"currency" char(3) NOT NULL,
	"value_type" varchar(20) NOT NULL,
	"fixed_amount" bigint,
	"min_amount" bigint,
	"max_amount" bigint,
	"expires_at" timestamp,
	"max_redemptions_per_code" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"code_hash" char(64) NOT NULL,
	"code_last4" varchar(4) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"partner_id" uuid,
	"expires_at" timestamp,
	"redeemed_by_user_id" text,
	"redeemed_at" timestamp,
	"redemption_txn_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"currency" char(3) NOT NULL,
	"current_balance" bigint DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_account_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"status" varchar(20) NOT NULL,
	"reference_type" varchar(50),
	"reference_id" varchar(128),
	"idempotency_key" varchar(128),
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storefront_layouts" ADD COLUMN "active_days" integer[];--> statement-breakpoint
ALTER TABLE "storefront_layouts" ADD COLUMN "active_start_hour" integer;--> statement-breakpoint
ALTER TABLE "storefront_layouts" ADD COLUMN "active_end_hour" integer;--> statement-breakpoint
ALTER TABLE "partner_request_log" ADD CONSTRAINT "partner_request_log_partner_id_partner_apps_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_campaign_id_voucher_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."voucher_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_redeemed_by_user_id_user_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_redemption_txn_id_wallet_transactions_id_fk" FOREIGN KEY ("redemption_txn_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_account_id_wallet_accounts_id_fk" FOREIGN KEY ("wallet_account_id") REFERENCES "public"."wallet_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_partner_req_log_idempotency" ON "partner_request_log" USING btree ("partner_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_vouchers_code_hash" ON "vouchers" USING btree ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_wallet_accounts_user_currency" ON "wallet_accounts" USING btree ("user_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_wallet_txn_idempotency" ON "wallet_transactions" USING btree ("wallet_account_id","idempotency_key") WHERE "wallet_transactions"."idempotency_key" IS NOT NULL;