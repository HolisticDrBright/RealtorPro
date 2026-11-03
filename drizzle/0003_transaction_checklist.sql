CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`template_id` text NOT NULL,
	`phase_key` text NOT NULL,
	`phase_order` integer NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`form_code` text,
	`form_rev` text,
	`authority` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`due_date` text,
	`due_override` text,
	`source_document_id` text,
	`task_id` text,
	`notes` text,
	`sort_order` integer NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ci_tx_idx` ON `checklist_items` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `ci_due_idx` ON `checklist_items` (`due_date`);--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`side` text NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`phases` text NOT NULL,
	`is_default` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checklist_templates_key_unique` ON `checklist_templates` (`key`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `listing_signed_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `acceptance_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `coe_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `disclosure_delivered_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `checklist_template_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `flags` text DEFAULT '{}';