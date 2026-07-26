CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text,
	`position` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activities_session_idx` ON `activities` (`session_id`);--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`answer` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `responses_activity_idx` ON `responses` (`activity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `responses_once_idx` ON `responses` (`activity_id`,`participant_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_code_idx` ON `sessions` (`code`);