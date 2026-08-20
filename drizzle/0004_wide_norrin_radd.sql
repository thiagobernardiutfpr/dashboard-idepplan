CREATE TABLE `item_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`item_id` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`uploaded_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `item_attachments_item_idx` ON `item_attachments` (`module`,`item_id`);--> statement-breakpoint
CREATE INDEX `item_attachments_created_at_idx` ON `item_attachments` (`created_at`);--> statement-breakpoint
CREATE TABLE `item_states` (
	`module` text NOT NULL,
	`item_id` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`removed` integer DEFAULT false NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`module`, `item_id`)
);
--> statement-breakpoint
CREATE INDEX `item_states_module_idx` ON `item_states` (`module`);--> statement-breakpoint
CREATE TABLE `party_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`expense_date` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`paid_by` text NOT NULL,
	`debtor` text NOT NULL,
	`creditor` text NOT NULL,
	`responsible` text NOT NULL,
	`status` text DEFAULT 'Pendente' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `party_expenses_event_idx` ON `party_expenses` (`event_name`);--> statement-breakpoint
CREATE INDEX `party_expenses_date_idx` ON `party_expenses` (`expense_date`);--> statement-breakpoint
CREATE TABLE `project_locations` (
	`project_id` text PRIMARY KEY NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`location_label` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_locations_updated_at_idx` ON `project_locations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `staff_demands` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_name` text NOT NULL,
	`title` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`due_date` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_demands_staff_idx` ON `staff_demands` (`staff_name`);--> statement-breakpoint
CREATE INDEX `staff_demands_due_idx` ON `staff_demands` (`due_date`);--> statement-breakpoint
CREATE TABLE `staff_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`message` text NOT NULL,
	`message_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_messages_date_idx` ON `staff_messages` (`message_date`);--> statement-breakpoint
CREATE TABLE `staff_profiles` (
	`staff_name` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_profiles_updated_at_idx` ON `staff_profiles` (`updated_at`);