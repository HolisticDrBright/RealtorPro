CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`fub_id` text,
	`contact_id` text,
	`title` text NOT NULL,
	`who` text,
	`location` text,
	`type` text,
	`starts_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`label` text,
	`approved_by` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`kind` text NOT NULL,
	`label` text,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`stored_path` text NOT NULL,
	`rights_confirmed` integer DEFAULT false NOT NULL,
	`alteration_status` text DEFAULT 'original' NOT NULL,
	`original_asset_id` text,
	`alteration_description` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`actor` text DEFAULT 'agent' NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`metadata` text DEFAULT '{}',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE TABLE `brokerage_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`user_profile_id` text,
	`name` text NOT NULL,
	`fair_housing_enforced` integer DEFAULT true NOT NULL,
	`allow_remote_generation` integer DEFAULT false NOT NULL,
	`require_disclosure_for_altered_media` integer DEFAULT true NOT NULL,
	`max_jobs_per_hour` integer DEFAULT 20 NOT NULL,
	`max_job_cost_usd` real DEFAULT 25 NOT NULL,
	`daily_spend_cap_usd` real DEFAULT 100 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_profile_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `buyer_criteria_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text,
	`label` text,
	`ceiling_text` text,
	`ceiling_amount` integer,
	`ceiling_hard` integer DEFAULT true NOT NULL,
	`hard_constraints` text DEFAULT '[]',
	`weighted_prefs` text DEFAULT '[]',
	`areas` text DEFAULT '[]',
	`must_haves` text DEFAULT '[]',
	`agreed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `buyer_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`criteria_profile_id` text,
	`property_id` text,
	`listing_import_id` text,
	`address` text,
	`score` integer DEFAULT 0 NOT NULL,
	`over_ceiling` integer DEFAULT false NOT NULL,
	`reasons` text DEFAULT '[]',
	`tradeoffs` text DEFAULT '[]',
	`missing_facts` text DEFAULT '[]',
	`verify_questions` text DEFAULT '[]',
	`created_at` text NOT NULL,
	FOREIGN KEY (`criteria_profile_id`) REFERENCES `buyer_criteria_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_import_id`) REFERENCES `listing_imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `column_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source_type` text DEFAULT 'mls_csv' NOT NULL,
	`mapping` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`fub_id` text,
	`name` text NOT NULL,
	`role` text,
	`stage` text,
	`next_step` text,
	`phone` text,
	`email` text,
	`sync_status` text DEFAULT 'Synced',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contacts_fub_idx` ON `contacts` (`fub_id`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`fub_id` text,
	`contact_id` text,
	`property_id` text,
	`name` text NOT NULL,
	`stage` text,
	`price` text,
	`risk_flag` text,
	`risk_issue` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`property_id` text,
	`contact_id` text,
	`job_id` text,
	`title` text,
	`content` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`provider` text,
	`model` text,
	`prompt_version` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exports` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`stored_path` text NOT NULL,
	`sha256` text,
	`byte_size` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `facts` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`listing_import_id` text,
	`source_document_id` text,
	`field` text NOT NULL,
	`value` text,
	`source` text NOT NULL,
	`confidence` text DEFAULT 'reported' NOT NULL,
	`conflicts_with` text,
	`supersedes_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_import_id`) REFERENCES `listing_imports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_document_id`) REFERENCES `source_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `facts_prop_idx` ON `facts` (`property_id`);--> statement-breakpoint
CREATE TABLE `generated_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text,
	`text` text NOT NULL,
	`sources` text DEFAULT '[]',
	`fact_ids` text DEFAULT '[]',
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`model` text,
	`prompt_version` text,
	`inputs` text DEFAULT '{}',
	`outputs` text DEFAULT '{}',
	`cost_estimate_usd` real DEFAULT 0,
	`is_remote` integer DEFAULT false NOT NULL,
	`approved_for_remote` integer DEFAULT false NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listing_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`source_document_id` text,
	`column_mapping_id` text,
	`property_id` text,
	`row_count` integer DEFAULT 0 NOT NULL,
	`valid_rows` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'parsed' NOT NULL,
	`issues` text DEFAULT '[]',
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_document_id`) REFERENCES `source_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`column_mapping_id`) REFERENCES `column_mappings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media_disclosures` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text,
	`original_asset_id` text,
	`alteration` text NOT NULL,
	`disclosure_text` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`original_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`fub_id` text,
	`contact_id` text,
	`body` text NOT NULL,
	`is_draft` integer DEFAULT true NOT NULL,
	`origin` text DEFAULT 'local' NOT NULL,
	`synced_to_fub` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`mls_number` text,
	`price` text,
	`beds` real,
	`baths` real,
	`sqft` text,
	`lot` text,
	`property_type` text,
	`features` text DEFAULT '[]',
	`remarks` text,
	`open_house` text,
	`status` text,
	`source_meta` text DEFAULT '{}',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`key_ref` text,
	`scopes` text DEFAULT '[]',
	`last_sync_at` text,
	`meta` text DEFAULT '{}',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shortlist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`shortlist_id` text,
	`match_id` text,
	`property_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shortlist_id`) REFERENCES `shortlists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `buyer_matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shortlists` (
	`id` text PRIMARY KEY NOT NULL,
	`criteria_profile_id` text,
	`name` text DEFAULT 'Shortlist' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`criteria_profile_id`) REFERENCES `buyer_criteria_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`stored_path` text NOT NULL,
	`meta` text DEFAULT '{}',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'fub' NOT NULL,
	`direction` text NOT NULL,
	`entity` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'OK' NOT NULL,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`fub_id` text,
	`contact_id` text,
	`deal_id` text,
	`title` text NOT NULL,
	`body` text,
	`due_at` text,
	`status` text DEFAULT 'open' NOT NULL,
	`origin` text DEFAULT 'local' NOT NULL,
	`synced_to_fub` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`license` text,
	`service_areas` text DEFAULT '[]',
	`default_brand_voice` text DEFAULT 'Warm, concrete, no hype',
	`quiet_hours` text DEFAULT '9:00 PM – 7:00 AM',
	`nurture_cadence` text DEFAULT 'Quarterly + anniversaries',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
