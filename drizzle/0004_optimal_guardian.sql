CREATE TABLE `match_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`kind` text NOT NULL,
	`context` text NOT NULL,
	`options` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`model` text NOT NULL,
	`raw_result` text,
	`subject` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`sms` text DEFAULT '' NOT NULL,
	`recipient` text DEFAULT '' NOT NULL,
	`usage` text,
	`estimated_cost_usd` real,
	`in_packet` integer DEFAULT true NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `match_packets` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`draft_ids` text NOT NULL,
	`filename` text NOT NULL,
	`vault_path` text,
	`vault_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
