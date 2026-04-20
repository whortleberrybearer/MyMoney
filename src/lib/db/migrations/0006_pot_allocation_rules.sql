CREATE TABLE `pot_allocation_rule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`name` text NOT NULL,
	`priority` integer NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pot_allocation_rule_condition` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` integer NOT NULL,
	`field` text NOT NULL,
	`operator` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `pot_allocation_rule`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pot_allocation_rule_action` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` integer NOT NULL,
	`pot_id` integer NOT NULL,
	`allocation_value` real NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `pot_allocation_rule`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pot_id`) REFERENCES `pot`(`id`) ON UPDATE no action ON DELETE no action
);
