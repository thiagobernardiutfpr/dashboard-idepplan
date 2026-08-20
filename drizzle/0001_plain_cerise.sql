CREATE TABLE `module_assignments` (
	`module` text NOT NULL,
	`item_id` text NOT NULL,
	`responsible` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`module`, `item_id`)
);
--> statement-breakpoint
CREATE INDEX `module_assignments_responsible_idx` ON `module_assignments` (`responsible`);--> statement-breakpoint
CREATE INDEX `module_assignments_updated_at_idx` ON `module_assignments` (`updated_at`);--> statement-breakpoint
CREATE TABLE `procurements` (
	`id` text PRIMARY KEY NOT NULL,
	`object` text NOT NULL,
	`modality` text NOT NULL,
	`process_number` text DEFAULT '' NOT NULL,
	`phase` text NOT NULL,
	`situation` text NOT NULL,
	`planned_publication_date` text,
	`session_date` text,
	`estimated_value` real,
	`funding_source` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `procurements_phase_idx` ON `procurements` (`phase`);--> statement-breakpoint
CREATE INDEX `procurements_situation_idx` ON `procurements` (`situation`);--> statement-breakpoint
CREATE INDEX `procurements_updated_at_idx` ON `procurements` (`updated_at`);