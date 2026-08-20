CREATE TABLE `council_bodies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`acronym` text DEFAULT '' NOT NULL,
	`body_type` text NOT NULL,
	`legal_act` text DEFAULT '' NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`responsible` text NOT NULL,
	`president` text DEFAULT '' NOT NULL,
	`secretary` text DEFAULT '' NOT NULL,
	`term_start` text NOT NULL,
	`term_end` text NOT NULL,
	`status` text DEFAULT 'Ativo' NOT NULL,
	`members` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `council_bodies_type_idx` ON `council_bodies` (`body_type`);--> statement-breakpoint
CREATE INDEX `council_bodies_status_idx` ON `council_bodies` (`status`);--> statement-breakpoint
CREATE INDEX `council_bodies_term_end_idx` ON `council_bodies` (`term_end`);--> statement-breakpoint
CREATE TABLE `council_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`body_id` text NOT NULL,
	`title` text NOT NULL,
	`meeting_date` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`agenda` text DEFAULT '' NOT NULL,
	`participants` text DEFAULT '' NOT NULL,
	`quorum` text DEFAULT '' NOT NULL,
	`deliberations` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Agendada' NOT NULL,
	`responsible` text NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `council_meetings_body_idx` ON `council_meetings` (`body_id`);--> statement-breakpoint
CREATE INDEX `council_meetings_date_idx` ON `council_meetings` (`meeting_date`);--> statement-breakpoint
CREATE INDEX `council_meetings_status_idx` ON `council_meetings` (`status`);--> statement-breakpoint
CREATE TABLE `master_plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`phase` text NOT NULL,
	`item_type` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`start_date` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'Não iniciado' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`responsible` text NOT NULL,
	`stakeholders` text DEFAULT '' NOT NULL,
	`legal_reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `master_plan_items_phase_idx` ON `master_plan_items` (`phase`);--> statement-breakpoint
CREATE INDEX `master_plan_items_due_date_idx` ON `master_plan_items` (`due_date`);--> statement-breakpoint
CREATE INDEX `master_plan_items_status_idx` ON `master_plan_items` (`status`);