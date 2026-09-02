CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`location` text,
	`source` text DEFAULT 'local' NOT NULL,
	`external_id` text,
	`contact_id` text,
	`property_id` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cal_start_idx` ON `calendar_events` (`starts_at`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'task' NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`due_date` text,
	`contact_id` text,
	`property_id` text,
	`notes` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `todos_due_idx` ON `todos` (`due_date`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`side` text NOT NULL,
	`contact_id` text,
	`property_id` text,
	`address` text NOT NULL,
	`price` real,
	`status` text DEFAULT 'active' NOT NULL,
	`stage` text,
	`closed_at` text,
	`commission_pct` real,
	`gci` real,
	`fub_deal_id` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tx_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE INDEX `tx_closed_idx` ON `transactions` (`closed_at`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `temperature` text DEFAULT 'warm';