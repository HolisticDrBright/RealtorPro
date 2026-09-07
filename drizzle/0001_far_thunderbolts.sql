CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`preview` text NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_name` text DEFAULT 'Agent' NOT NULL,
	`title` text DEFAULT 'Luxury Real Estate Advisor',
	`brokerage` text DEFAULT '',
	`annual_goal` real DEFAULT 0 NOT NULL,
	`default_commission_pct` real DEFAULT 2.5 NOT NULL,
	`default_split_pct` real DEFAULT 68 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "agent_name", "title", "brokerage", "annual_goal", "default_commission_pct", "default_split_pct", "created_at", "updated_at") SELECT "id", "agent_name", "title", "brokerage", "annual_goal", "default_commission_pct", "default_split_pct", "created_at", "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;