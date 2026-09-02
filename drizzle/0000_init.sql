CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text,
	`type` text DEFAULT 'system' NOT NULL,
	`summary` text NOT NULL,
	`ref_type` text,
	`ref_id` text,
	`occurred_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activities_contact_idx` ON `activities` (`contact_id`);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'showing' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`location` text,
	`contact_id` text,
	`property_id` text,
	`transaction_id` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `appt_start_idx` ON `appointments` (`starts_at`);--> statement-breakpoint
CREATE TABLE `buyers` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`temperature` text DEFAULT 'warm' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`price_min` real,
	`price_max` real,
	`target_areas` text DEFAULT '[]',
	`min_beds` real,
	`min_baths` real,
	`min_sqft` real,
	`lot_requirements` text,
	`property_type` text,
	`must_haves` text DEFAULT '[]',
	`deal_breakers` text DEFAULT '[]',
	`financing_type` text,
	`pre_approval_amount` real,
	`timeline` text,
	`properties_sent` integer DEFAULT 0 NOT NULL,
	`properties_toured` integer DEFAULT 0 NOT NULL,
	`offers_made` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`scheduled_date` text,
	`scheduled_time` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`reason` text,
	`notes` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`outcome` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`photo_url` text,
	`phone` text,
	`email` text,
	`spouse` text,
	`birthday` text,
	`home_address` text,
	`type` text DEFAULT 'lead' NOT NULL,
	`lead_source` text DEFAULT 'other',
	`tags` text DEFAULT '[]',
	`price_min` real,
	`price_max` real,
	`preferred_areas` text DEFAULT '[]',
	`current_property` text,
	`stage` text DEFAULT 'new_lead' NOT NULL,
	`stage_order` integer DEFAULT 0 NOT NULL,
	`est_value` real,
	`est_commission` real,
	`probability` integer DEFAULT 20 NOT NULL,
	`next_action` text,
	`last_contact_at` text,
	`next_follow_up_at` text,
	`check_back_at` text,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contacts_stage_idx` ON `contacts` (`stage`);--> statement-breakpoint
CREATE INDEX `contacts_type_idx` ON `contacts` (`type`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`seller_contact_id` text,
	`list_price` real NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`listed_at` text,
	`showings` integer DEFAULT 0 NOT NULL,
	`offers` integer DEFAULT 0 NOT NULL,
	`open_houses` integer DEFAULT 0 NOT NULL,
	`commission_pct` real DEFAULT 2.5 NOT NULL,
	`next_action` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seller_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`name` text NOT NULL,
	`due_date` text,
	`completed_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`notes` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`contact_id` text,
	`property_id` text,
	`transaction_id` text,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`kind` text DEFAULT 'info' NOT NULL,
	`href` text,
	`read_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text,
	`property_id` text,
	`list_price` real,
	`offer_price` real NOT NULL,
	`submitted_at` text,
	`seller_counter` real,
	`current_offer` real,
	`financing` text,
	`down_payment` real,
	`closing_timeline` text,
	`contingencies` text DEFAULT '[]',
	`status` text DEFAULT 'preparing' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`area` text,
	`kind` text DEFAULT 'off_market' NOT NULL,
	`expected_price` real,
	`beds` real,
	`baths` real,
	`sqft` real,
	`property_type` text,
	`source_agent` text,
	`contact_id` text,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`zip` text,
	`beds` real,
	`baths` real,
	`sqft` real,
	`lot_sqft` real,
	`property_type` text DEFAULT 'Single Family',
	`year_built` integer,
	`photo_url` text,
	`view` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sellers` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`property_address` text,
	`city` text,
	`estimated_value` real,
	`expected_list_price` real,
	`timeline` text,
	`motivation` text,
	`listing_appointment_at` text,
	`probability` integer DEFAULT 30 NOT NULL,
	`stage` text DEFAULT 'lead' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_name` text DEFAULT 'Vanessa Bukowski' NOT NULL,
	`title` text DEFAULT 'Luxury Real Estate Advisor',
	`brokerage` text DEFAULT 'SERHANT.',
	`annual_goal` real DEFAULT 200000 NOT NULL,
	`default_commission_pct` real DEFAULT 2.5 NOT NULL,
	`default_split_pct` real DEFAULT 68 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'client_follow_up' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` text,
	`due_time` text,
	`contact_id` text,
	`property_id` text,
	`transaction_id` text,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE TABLE `touchpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`kind` text DEFAULT 'quarterly' NOT NULL,
	`due_date` text NOT NULL,
	`completed_at` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`listing_id` text,
	`contact_id` text,
	`side` text DEFAULT 'buyer' NOT NULL,
	`status` text DEFAULT 'escrow' NOT NULL,
	`purchase_price` real NOT NULL,
	`commission_pct` real DEFAULT 2.5 NOT NULL,
	`referral_fee` real DEFAULT 0 NOT NULL,
	`broker_split_pct` real DEFAULT 68 NOT NULL,
	`expenses` real DEFAULT 0 NOT NULL,
	`lead_source` text,
	`escrow_opened_at` text,
	`closing_date` text,
	`closed_at` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tx_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE TABLE `vault_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`title` text NOT NULL,
	`tags` text DEFAULT '[]',
	`links` text DEFAULT '[]',
	`frontmatter` text DEFAULT '{}',
	`excerpt` text,
	`word_count` integer DEFAULT 0 NOT NULL,
	`contact_id` text,
	`property_id` text,
	`link_basis` text,
	`record_type` text,
	`sha256` text NOT NULL,
	`modified_at` text,
	`indexed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vault_notes_path_unique` ON `vault_notes` (`path`);--> statement-breakpoint
CREATE INDEX `vault_contact_idx` ON `vault_notes` (`contact_id`);--> statement-breakpoint
CREATE INDEX `vault_property_idx` ON `vault_notes` (`property_id`);