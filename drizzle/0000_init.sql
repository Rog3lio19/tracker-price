CREATE TABLE `alert_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`threshold` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`cooldown_hours` integer DEFAULT 24 NOT NULL,
	`last_triggered_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`alert_rule_id` integer,
	`message` text NOT NULL,
	`telegram_message_id` integer,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`alert_rule_id`) REFERENCES `alert_rules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`price` integer,
	`list_price` integer,
	`in_stock` integer NOT NULL,
	`seller_id` text,
	`source` text NOT NULL,
	`confidence` real,
	`screenshot_path` text,
	`is_suspicious` integer DEFAULT false NOT NULL,
	`checked_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `snapshots_product_date_idx` ON `price_snapshots` (`product_id`,`checked_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`marketplace` text NOT NULL,
	`url` text NOT NULL,
	`canonical_url` text NOT NULL,
	`external_id` text,
	`catalog_product_id` text,
	`title` text,
	`image_url` text,
	`currency` text DEFAULT 'MXN' NOT NULL,
	`seller_id` text,
	`seller_name` text,
	`seller_lock` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`check_interval_minutes` integer DEFAULT 360 NOT NULL,
	`price_selector` text,
	`last_price` integer,
	`lowest_price` integer,
	`last_checked_at` integer,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_canonical_url_unique` ON `products` (`canonical_url`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);--> statement-breakpoint
CREATE TABLE `scrape_errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`message` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
