CREATE TABLE `process_enrichments` (
	`process_id` text PRIMARY KEY NOT NULL,
	`property_registration` text DEFAULT '' NOT NULL,
	`lot` text DEFAULT '' NOT NULL,
	`block` text DEFAULT '' NOT NULL,
	`neighborhood` text DEFAULT '' NOT NULL,
	`applicant` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`request` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`action_type` text DEFAULT '' NOT NULL,
	`source_files` text DEFAULT '[]' NOT NULL,
	`confidence_json` text DEFAULT '{}' NOT NULL,
	`analyzed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `process_enrichments_registration_idx` ON `process_enrichments` (`property_registration`);--> statement-breakpoint
CREATE INDEX `process_enrichments_updated_at_idx` ON `process_enrichments` (`updated_at`);