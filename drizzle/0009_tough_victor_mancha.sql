CREATE TABLE `council_members` (
	`id` text PRIMARY KEY NOT NULL,
	`body_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`entity` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`requests` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Ativo' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `council_members_body_idx` ON `council_members` (`body_id`);--> statement-breakpoint
CREATE INDEX `council_members_name_idx` ON `council_members` (`name`);--> statement-breakpoint
CREATE INDEX `council_members_status_idx` ON `council_members` (`status`);--> statement-breakpoint
CREATE TABLE `council_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`body_id` text NOT NULL,
	`title` text NOT NULL,
	`requester` text DEFAULT '' NOT NULL,
	`request_date` text NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Recebida' NOT NULL,
	`responsible` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`response` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `council_requests_body_idx` ON `council_requests` (`body_id`);--> statement-breakpoint
CREATE INDEX `council_requests_due_idx` ON `council_requests` (`due_date`);--> statement-breakpoint
CREATE INDEX `council_requests_status_idx` ON `council_requests` (`status`);--> statement-breakpoint
CREATE TABLE `workspace_agenda_items` (
	`id` text PRIMARY KEY NOT NULL,
	`context_type` text NOT NULL,
	`context_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'Reunião' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`location` text DEFAULT '' NOT NULL,
	`participants` text DEFAULT '[]' NOT NULL,
	`responsible` text NOT NULL,
	`status` text DEFAULT 'Agendado' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspace_agenda_context_idx` ON `workspace_agenda_items` (`context_type`,`context_id`);--> statement-breakpoint
CREATE INDEX `workspace_agenda_starts_idx` ON `workspace_agenda_items` (`starts_at`);--> statement-breakpoint
CREATE INDEX `workspace_agenda_status_idx` ON `workspace_agenda_items` (`status`);