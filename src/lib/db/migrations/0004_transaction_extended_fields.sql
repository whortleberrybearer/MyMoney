ALTER TABLE `transaction` ADD `payee` text;--> statement-breakpoint
ALTER TABLE `transaction` ADD `reference` text;--> statement-breakpoint
ALTER TABLE `transaction` ADD `category_id` integer REFERENCES category(id);--> statement-breakpoint
ALTER TABLE `transaction` ADD `running_balance` real DEFAULT 0 NOT NULL;