CREATE TABLE `multipart_attachment_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text NOT NULL,
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
CREATE INDEX `multipart_attachment_uploads_created_at_idx` ON `multipart_attachment_uploads` (`created_at`);