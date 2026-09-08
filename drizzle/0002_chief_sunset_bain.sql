CREATE TABLE `investors` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`strategy` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`target_areas` text DEFAULT '[]',
	`property_types` text DEFAULT '[]',
	`budget_min` real,
	`budget_max` real,
	`available_capital` real,
	`target_cap_rate` real,
	`target_cash_on_cash` real,
	`financing_type` text,
	`timeline` text,
	`must_haves` text DEFAULT '[]',
	`deal_breakers` text DEFAULT '[]',
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investors_contact_idx` ON `investors` (`contact_id`);