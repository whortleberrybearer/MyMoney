CREATE TABLE `account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`institution_id` integer NOT NULL,
	`account_type_id` integer NOT NULL,
	`currency` text NOT NULL,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`opening_date` text NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institution`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_type_id`) REFERENCES `account_type`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `account_tag` (
	`account_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`account_id`, `tag_id`),
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action
);
