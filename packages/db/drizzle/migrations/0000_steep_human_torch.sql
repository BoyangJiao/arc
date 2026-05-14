CREATE TYPE "public"."currency" AS ENUM('CNY', 'HKD', 'USD', 'JPY', 'BTC', 'ETH');--> statement-breakpoint
CREATE TYPE "public"."finance_color_mode" AS ENUM('redUpGreenDown', 'greenUpRedDown');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('zh', 'en');--> statement-breakpoint
CREATE TYPE "public"."market" AS ENUM('CN', 'HK', 'US', 'CRYPTO', 'FUND');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"market" "market" NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"currency" "currency" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_id_format" CHECK ("assets"."id" ~ '^[A-Z]+:.+$'),
	CONSTRAINT "assets_id_consistency" CHECK ("assets"."id" = "assets"."market" || ':' || "assets"."symbol")
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"from_currency" "currency" NOT NULL,
	"to_currency" "currency" NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_from_currency_to_currency_as_of_pk" PRIMARY KEY("from_currency","to_currency","as_of"),
	CONSTRAINT "fx_rates_from_to_distinct" CHECK ("fx_rates"."from_currency" <> "fx_rates"."to_currency"),
	CONSTRAINT "fx_rates_rate_positive" CHECK ("fx_rates"."rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reporting_currency" "currency" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"asset_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"shares" numeric(28, 12) NOT NULL,
	"price_per_share" numeric(28, 12) NOT NULL,
	"currency" "currency" NOT NULL,
	"fee" numeric(28, 12) DEFAULT '0' NOT NULL,
	"trade_date" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_shares_positive" CHECK ("transactions"."shares" > 0),
	CONSTRAINT "transactions_price_non_negative" CHECK ("transactions"."price_per_share" >= 0),
	CONSTRAINT "transactions_fee_non_negative" CHECK ("transactions"."fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"reporting_currency" "currency" DEFAULT 'CNY' NOT NULL,
	"locale" "locale" DEFAULT 'zh' NOT NULL,
	"finance_color_mode" "finance_color_mode" DEFAULT 'greenUpRedDown' NOT NULL,
	"redacted" boolean DEFAULT false NOT NULL,
	"has_seen_welcome" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"asset_id" text NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"price" numeric(28, 12) NOT NULL,
	"currency" "currency" NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_snapshots_asset_id_as_of_pk" PRIMARY KEY("asset_id","as_of")
);
--> statement-breakpoint
CREATE TABLE "portfolio_value_snapshots" (
	"portfolio_id" uuid NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"total_value" numeric(28, 12) NOT NULL,
	"reporting_currency" "currency" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_value_snapshots_portfolio_id_as_of_pk" PRIMARY KEY("portfolio_id","as_of")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_value_snapshots" ADD CONSTRAINT "portfolio_value_snapshots_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fx_rates_as_of_idx" ON "fx_rates" USING btree ("as_of" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "portfolios_user_id_idx" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_portfolio_trade_date_idx" ON "transactions" USING btree ("portfolio_id","trade_date");--> statement-breakpoint
CREATE INDEX "transactions_portfolio_asset_idx" ON "transactions" USING btree ("portfolio_id","asset_id");--> statement-breakpoint
CREATE INDEX "price_snapshots_as_of_idx" ON "price_snapshots" USING btree ("as_of" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "pv_snapshots_as_of_idx" ON "portfolio_value_snapshots" USING btree ("as_of" DESC NULLS LAST);