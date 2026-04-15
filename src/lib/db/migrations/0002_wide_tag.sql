CREATE TABLE `pot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`name` text NOT NULL,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`opening_date` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pot_tag` (
	`pot_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`pot_id`, `tag_id`),
	FOREIGN KEY (`pot_id`) REFERENCES `pot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`pot_id` integer,
	`transfer_id` integer,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`type` text NOT NULL,
	`is_void` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pot_id`) REFERENCES `pot`(`id`) ON UPDATE no action ON DELETE no action
);
