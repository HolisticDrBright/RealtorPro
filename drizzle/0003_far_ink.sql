CREATE TABLE `vault_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`title` text NOT NULL,
	`tags` text DEFAULT '[]',
	`links` text DEFAULT '[]',
	`frontmatter` text DEFAULT '{}',
	`excerpt` text,
	`word_count` integer DEFAULT 0,
	`contact_id` text,
	`property_id` text,
	`link_basis` text,
	`sha256` text NOT NULL,
	`modified_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vault_path_idx` ON `vault_notes` (`path`);--> statement-breakpoint
CREATE INDEX `vault_contact_idx` ON `vault_notes` (`contact_id`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `ends_at` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `description` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `tags` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `contacts` ADD `source` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `assigned_to` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `last_activity_at` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `deal_status` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `pipeline` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `close_date` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `subject` text;