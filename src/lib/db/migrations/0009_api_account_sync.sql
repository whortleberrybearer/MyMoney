ALTER TABLE `account` ADD `is_api_synced` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `transaction` ADD `external_id` text;
--> statement-breakpoint
CREATE TABLE `institution_api_connection` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`institution_id` integer NOT NULL,
	`api_type` text NOT NULL,
	`keychain_key` text NOT NULL,
	`last_synced_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institution`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT OR IGNORE INTO `transaction_type` (`name`) VALUES ('api_sync');
