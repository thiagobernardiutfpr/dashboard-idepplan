CREATE TABLE `empresa_facil_records` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL,
	`action_type` text NOT NULL,
	`protocol` text DEFAULT '' NOT NULL,
	`requested_at` text NOT NULL,
	`risk_level` text DEFAULT '' NOT NULL,
	`property_code` text DEFAULT '' NOT NULL,
	`property_registration` text DEFAULT '' NOT NULL,
	`primary_activity_code` text DEFAULT '' NOT NULL,
	`primary_activity_description` text DEFAULT '' NOT NULL,
	`cnpj` text DEFAULT '' NOT NULL,
	`classification` text DEFAULT '' NOT NULL,
	`applicant_code` text DEFAULT '' NOT NULL,
	`applicant_name` text DEFAULT '' NOT NULL,
	`economic_registration` text DEFAULT '' NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`indicators` text DEFAULT '' NOT NULL,
	`source_file` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `empresa_facil_records_status_idx` ON `empresa_facil_records` (`status`);--> statement-breakpoint
CREATE INDEX `empresa_facil_records_requested_at_idx` ON `empresa_facil_records` (`requested_at`);--> statement-breakpoint
CREATE INDEX `empresa_facil_records_risk_level_idx` ON `empresa_facil_records` (`risk_level`);--> statement-breakpoint
CREATE INDEX `empresa_facil_records_protocol_idx` ON `empresa_facil_records` (`protocol`);--> statement-breakpoint
CREATE TABLE `report_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`inserted_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`imported_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `report_imports_module_idx` ON `report_imports` (`module`);--> statement-breakpoint
CREATE INDEX `report_imports_created_at_idx` ON `report_imports` (`created_at`);