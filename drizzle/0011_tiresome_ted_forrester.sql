CREATE TABLE IF NOT EXISTS `eiv_analyses` (
	`process_id` text PRIMARY KEY NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`source_files` text DEFAULT '[]' NOT NULL,
	`coverage_score` integer DEFAULT 0 NOT NULL,
	`conclusion` text DEFAULT '' NOT NULL,
	`analyzed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `eiv_analyses_score_idx` ON `eiv_analyses` (`coverage_score`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `eiv_analyses_updated_at_idx` ON `eiv_analyses` (`updated_at`);--> statement-breakpoint
ALTER TABLE `master_plan_items` ADD `legal_article` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `master_plan_items` ADD `legal_paragraph` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `master_plan_items` ADD `legal_letter` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `master_plan_items` ADD `legal_item` text DEFAULT '' NOT NULL;
