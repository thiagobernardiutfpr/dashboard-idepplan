CREATE TABLE `pai_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`axis` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`start_date` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'Planejado' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`estimated_value` real,
	`funding_source` text DEFAULT '' NOT NULL,
	`responsible` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pai_items_axis_idx` ON `pai_items` (`axis`);--> statement-breakpoint
CREATE INDEX `pai_items_due_date_idx` ON `pai_items` (`due_date`);--> statement-breakpoint
CREATE INDEX `pai_items_status_idx` ON `pai_items` (`status`);