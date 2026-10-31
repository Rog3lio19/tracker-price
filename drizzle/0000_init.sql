CREATE TABLE "alert_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alert_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"type" text NOT NULL,
	"threshold" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"cooldown_hours" integer DEFAULT 24 NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"alert_rule_id" integer,
	"message" text NOT NULL,
	"telegram_message_id" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"price" integer,
	"list_price" integer,
	"in_stock" boolean NOT NULL,
	"seller_id" text,
	"source" text NOT NULL,
	"confidence" real,
	"screenshot_path" text,
	"is_suspicious" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"marketplace" text NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"external_id" text,
	"catalog_product_id" text,
	"title" text,
	"image_url" text,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"seller_id" text,
	"seller_name" text,
	"seller_lock" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"check_interval_minutes" integer DEFAULT 360 NOT NULL,
	"price_selector" text,
	"last_price" integer,
	"lowest_price" integer,
	"last_checked_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE "scrape_errors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scrape_errors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"message" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_errors" ADD CONSTRAINT "scrape_errors_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_product_date_idx" ON "price_snapshots" USING btree ("product_id","checked_at");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");