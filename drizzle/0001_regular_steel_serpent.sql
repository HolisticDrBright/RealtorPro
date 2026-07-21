CREATE TABLE `brand_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`broker` text,
	`contact` text,
	`disclaimer` text,
	`colors` text DEFAULT '[]',
	`typography` text DEFAULT 'Archivo',
	`logo_asset_id` text,
	`owned_by_user` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comp_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`comp_id` text,
	`label` text NOT NULL,
	`amount` real,
	`note` text,
	`agent_entered` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`comp_id`) REFERENCES `comps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comp_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`source_document_id` text,
	`name` text NOT NULL,
	`comp_type` text DEFAULT 'sales' NOT NULL,
	`weights` text DEFAULT '{}',
	`filters` text DEFAULT '{}',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comps` (
	`id` text PRIMARY KEY NOT NULL,
	`comp_set_id` text,
	`address` text,
	`asset_type` text,
	`transaction_date` text,
	`price` real,
	`size` real,
	`price_per_sf` real,
	`price_per_unit` real,
	`cap_rate` real,
	`days_on_market` integer,
	`distance_mi` real,
	`source` text,
	`source_date` text,
	`lat` real,
	`lng` real,
	`verification_status` text DEFAULT 'needs_verification' NOT NULL,
	`missing_fields` text DEFAULT '[]',
	`score` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`comp_set_id`) REFERENCES `comp_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `derived_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` real,
	`display_value` text,
	`unit` text,
	`formula` text,
	`source_fact_ids` text DEFAULT '[]',
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `disclosures` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`mode` text DEFAULT 'brokerage' NOT NULL,
	`editable` integer DEFAULT true NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `export_records` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`format` text NOT NULL,
	`stored_path` text NOT NULL,
	`sha256` text,
	`byte_size` integer,
	`brand_profile_id` text,
	`editable_text` integer DEFAULT true,
	`metadata` text DEFAULT '{}',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `farm_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_name` text,
	`address` text,
	`area` text,
	`relationship` text,
	`contact_id` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `om_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`name` text NOT NULL,
	`address` text,
	`market` text,
	`asset_type` text,
	`price` text,
	`brand_profile_id` text,
	`template_profile_id` text,
	`approval_state` text DEFAULT 'Draft' NOT NULL,
	`owner_name` text DEFAULT 'Avery Sandoval',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`brand_profile_id`) REFERENCES `brand_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_profile_id`) REFERENCES `template_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `om_drafts_prop_idx` ON `om_drafts` (`property_id`);--> statement-breakpoint
CREATE TABLE `om_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`om_draft_id` text,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`page_style` text DEFAULT 'editorial' NOT NULL,
	`content_blocks` text DEFAULT '[]',
	`needs_review` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`om_draft_id`) REFERENCES `om_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rent_roll_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`rent_roll_id` text,
	`unit_ref` text,
	`code` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`message` text NOT NULL,
	`source_value` text,
	`normalized_value` text,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`rent_roll_id`) REFERENCES `rent_rolls`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rent_roll_units` (
	`id` text PRIMARY KEY NOT NULL,
	`rent_roll_id` text,
	`unit` text,
	`tenant` text,
	`sf` real,
	`lease_start` text,
	`lease_end` text,
	`monthly_rent` real,
	`annual_rent` real,
	`deposit` real,
	`concessions` real,
	`arrears` real,
	`status` text,
	`notes` text,
	`source_raw` text DEFAULT '{}',
	`needs_review` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`rent_roll_id`) REFERENCES `rent_rolls`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rent_rolls` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`source_document_id` text,
	`mapping_profile_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`unit_count` integer DEFAULT 0,
	`note` text,
	`local_only` integer DEFAULT true NOT NULL,
	`redact_pii` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signal_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_id` text,
	`action` text NOT NULL,
	`detail` text DEFAULT '{}',
	`actor` text DEFAULT 'Avery Sandoval',
	`created_at` text NOT NULL,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`contact_id` text,
	`property_id` text,
	`deal_id` text,
	`source_kind` text NOT NULL,
	`source_ref` text,
	`source_date` text,
	`reason` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`confidence_basis` text,
	`suggested_action` text,
	`related_label` text,
	`assigned_agent` text DEFAULT 'Avery Sandoval',
	`status` text DEFAULT 'new' NOT NULL,
	`snooze_until` text,
	`dismiss_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `signals_type_idx` ON `signals` (`type`);--> statement-breakpoint
CREATE INDEX `signals_status_idx` ON `signals` (`status`);--> statement-breakpoint
CREATE TABLE `storyboard_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`storyboard_id` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`beat` text NOT NULL,
	`camera_movement` text,
	`duration_sec` integer DEFAULT 3,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`storyboard_id`) REFERENCES `storyboards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `storyboards` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`format` text DEFAULT '16:9' NOT NULL,
	`duration_sec` integer DEFAULT 15 NOT NULL,
	`visual_direction` text DEFAULT 'architectural editorial',
	`camera_movement` text DEFAULT 'slow push-in',
	`boundary_style` text DEFAULT 'none' NOT NULL,
	`text_overlays` text DEFAULT '{}',
	`disclosure_mode` text DEFAULT 'brokerage' NOT NULL,
	`budget_cap_usd` real DEFAULT 50 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `visualizer_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `template_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`family` text,
	`description` text,
	`is_original` integer DEFAULT true NOT NULL,
	`config` text DEFAULT '{}',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `template_rights_confirmations` (
	`id` text PRIMARY KEY NOT NULL,
	`template_profile_id` text,
	`confirmed_by` text NOT NULL,
	`ownership_basis` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`template_profile_id`) REFERENCES `template_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verification_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_run_id` text,
	`om_draft_id` text,
	`lens` text NOT NULL,
	`severity` text NOT NULL,
	`page_key` text,
	`code` text NOT NULL,
	`message` text NOT NULL,
	`repair_action` text,
	`auto_fixable` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`verification_run_id`) REFERENCES `verification_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`om_draft_id`) REFERENCES `om_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `findings_run_idx` ON `verification_findings` (`verification_run_id`);--> statement-breakpoint
CREATE TABLE `verification_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`om_draft_id` text,
	`lens` text DEFAULT 'all' NOT NULL,
	`status` text DEFAULT 'complete' NOT NULL,
	`summary` text DEFAULT '{}',
	`created_at` text NOT NULL,
	FOREIGN KEY (`om_draft_id`) REFERENCES `om_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visualization_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`storyboard_id` text,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`model` text,
	`inputs` text DEFAULT '{}',
	`outputs` text DEFAULT '{}',
	`cost_estimate_usd` real DEFAULT 0,
	`is_remote` integer DEFAULT false NOT NULL,
	`approved_for_remote` integer DEFAULT false NOT NULL,
	`boundary_allowed` integer DEFAULT false NOT NULL,
	`disclosure_id` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `visualizer_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`storyboard_id`) REFERENCES `storyboards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visualizer_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`name` text NOT NULL,
	`address` text,
	`visualization_type` text DEFAULT 'land_teaser' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`owner_name` text DEFAULT 'Avery Sandoval',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visualizer_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`source_document_id` text,
	`asset_id` text,
	`kind` text NOT NULL,
	`label` text,
	`rights_confirmed` integer DEFAULT false NOT NULL,
	`boundary_verified` integer DEFAULT false NOT NULL,
	`boundary_basis` text DEFAULT 'none',
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `visualizer_projects`(`id`) ON UPDATE no action ON DELETE no action
);
