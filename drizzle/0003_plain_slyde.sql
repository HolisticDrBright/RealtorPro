CREATE TABLE `jarvis_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`question` text NOT NULL,
	`answer` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`model` text NOT NULL,
	`time_zone` text NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	`drafts` text DEFAULT '[]' NOT NULL,
	`review_id` text,
	`usage` text,
	`estimated_cost_usd` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
