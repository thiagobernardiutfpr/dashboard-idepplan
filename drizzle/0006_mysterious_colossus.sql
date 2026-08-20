CREATE TABLE `report_import_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`source_file` text NOT NULL,
	`source_sheet` text DEFAULT '' NOT NULL,
	`source_row` integer DEFAULT 0 NOT NULL,
	`data_json` text NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`imported_by` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `report_import_rows_module_idx` ON `report_import_rows` (`module`);--> statement-breakpoint
CREATE INDEX `report_import_rows_source_idx` ON `report_import_rows` (`module`,`source_file`);--> statement-breakpoint
CREATE INDEX `report_import_rows_imported_at_idx` ON `report_import_rows` (`imported_at`);