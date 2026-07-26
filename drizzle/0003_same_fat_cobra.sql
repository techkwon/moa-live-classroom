CREATE TABLE `board_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`author_name` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`file_key` text,
	`file_name` text,
	`file_type` text,
	`file_size` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `board_sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `board_posts_section_idx` ON `board_posts` (`section_id`);--> statement-breakpoint
CREATE TABLE `board_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`title` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `board_sections_board_idx` ON `board_sections` (`board_id`);--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`owner_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_code_idx` ON `boards` (`code`);--> statement-breakpoint
CREATE INDEX `boards_owner_idx` ON `boards` (`owner_email`);