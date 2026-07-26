CREATE TABLE `response_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `response_likes_response_idx` ON `response_likes` (`response_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `response_likes_once_idx` ON `response_likes` (`response_id`,`participant_id`);--> statement-breakpoint
CREATE TABLE `session_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`emoji` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_reactions_session_idx` ON `session_reactions` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_reactions_once_idx` ON `session_reactions` (`session_id`,`participant_id`);--> statement-breakpoint
ALTER TABLE `activities` ADD `accepting` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `reveal_answer` integer DEFAULT false NOT NULL;