CREATE TABLE `agenda_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`location` text DEFAULT '' NOT NULL,
	`participants` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agenda_items_starts_at_idx` ON `agenda_items` (`starts_at`);--> statement-breakpoint
CREATE INDEX `agenda_items_status_idx` ON `agenda_items` (`status`);--> statement-breakpoint
CREATE TABLE `geoprocessing_demands` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`requester` text NOT NULL,
	`demand_date` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `geoprocessing_demands_demand_date_idx` ON `geoprocessing_demands` (`demand_date`);--> statement-breakpoint
CREATE INDEX `geoprocessing_demands_completed_idx` ON `geoprocessing_demands` (`completed`);--> statement-breakpoint
CREATE TABLE `manual_processes` (
	`id` text PRIMARY KEY NOT NULL,
	`process_number` text NOT NULL,
	`area` text NOT NULL,
	`applicant` text NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`cnpj` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`action_type` text DEFAULT '' NOT NULL,
	`opened_at` text,
	`planned_close_at` text,
	`observation` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manual_processes_opened_at_idx` ON `manual_processes` (`opened_at`);--> statement-breakpoint
CREATE INDEX `manual_processes_updated_at_idx` ON `manual_processes` (`updated_at`);--> statement-breakpoint
CREATE TABLE `manual_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`priority` integer,
	`area_to_build_m2` real,
	`area_to_renovate_m2` real,
	`department` text DEFAULT '' NOT NULL,
	`deadline` text,
	`current_status` text NOT NULL,
	`stage` text NOT NULL,
	`process_number` text DEFAULT '' NOT NULL,
	`dependency` text DEFAULT '' NOT NULL,
	`funding_source` text DEFAULT '' NOT NULL,
	`value` real,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manual_projects_stage_idx` ON `manual_projects` (`stage`);--> statement-breakpoint
CREATE INDEX `manual_projects_updated_at_idx` ON `manual_projects` (`updated_at`);