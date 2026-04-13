CREATE TABLE `account_type` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`asset_liability` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_type_name_unique` ON `account_type` (`name`);--> statement-breakpoint
CREATE TABLE `category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_name_unique` ON `category` (`name`);--> statement-breakpoint
CREATE TABLE `institution` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institution_name_unique` ON `institution` (`name`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_name_unique` ON `tag` (`name`);--> statement-breakpoint
CREATE TABLE `transaction_type` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_type_name_unique` ON `transaction_type` (`name`);--> statement-breakpoint
INSERT OR IGNORE INTO `account_type` (`name`, `asset_liability`) VALUES
  ('Current', 'asset'),
  ('Savings', 'asset'),
  ('ISA', 'asset'),
  ('Stocks & Shares ISA', 'asset'),
  ('Pension', 'asset'),
  ('Mortgage', 'liability');--> statement-breakpoint
INSERT OR IGNORE INTO `transaction_type` (`name`) VALUES
  ('imported'),
  ('manual'),
  ('virtual_transfer');--> statement-breakpoint
INSERT OR IGNORE INTO `tag` (`name`) VALUES
  ('Personal'),
  ('Joint');--> statement-breakpoint
INSERT OR IGNORE INTO `category` (`name`, `is_system`, `sort_order`) VALUES
  ('Uncategorised', 1, 999),
  ('Salary', 0, 1),
  ('Income', 0, 2),
  ('Bills', 0, 3),
  ('Groceries', 0, 4),
  ('Eating out', 0, 5),
  ('Transport', 0, 6),
  ('Vehicle', 0, 7),
  ('Home', 0, 8),
  ('DIY', 0, 9),
  ('Utilities', 0, 10),
  ('Rent / mortgage', 0, 11),
  ('Insurance', 0, 12),
  ('Subscriptions', 0, 13),
  ('Entertainment', 0, 14),
  ('Clothing', 0, 15),
  ('Health', 0, 16),
  ('Fitness', 0, 17),
  ('Holidays', 0, 18),
  ('Gifts', 0, 19),
  ('Charity', 0, 20),
  ('Education', 0, 21),
  ('Hobby', 0, 22),
  ('Pets', 0, 23),
  ('Gambling', 0, 24),
  ('Investment', 0, 25),
  ('Transfer', 0, 26),
  ('Tax', 0, 27),
  ('Fees', 0, 28),
  ('Other', 0, 29);