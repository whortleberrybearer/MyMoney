CREATE TABLE `institution_column_mapping` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`institution_id` integer NOT NULL,
	`mapping_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institution`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institution_column_mapping_institution_id_idx` ON `institution_column_mapping` (`institution_id`);
