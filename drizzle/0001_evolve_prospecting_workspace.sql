CREATE TABLE `drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`status` enum('draft','edited','reviewed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_secrets` (
	`provider` varchar(48) NOT NULL,
	`encryptedValue` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_secrets_provider` PRIMARY KEY(`provider`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` enum('google_maps','google_search','manual') NOT NULL DEFAULT 'manual',
	`sourceId` varchar(255),
	`sourceUrl` text,
	`name` varchar(255) NOT NULL,
	`specialty` varchar(160),
	`address` text,
	`city` varchar(160),
	`state` varchar(120),
	`country` varchar(100),
	`website` text,
	`email` varchar(320),
	`phone` varchar(80),
	`linkedin` text,
	`instagram` text,
	`facebook` text,
	`contactSourceVerified` boolean NOT NULL DEFAULT false,
	`rating` double,
	`reviewCount` int,
	`emailStatus` enum('unverified','deliverable','invalid','uncertain') NOT NULL DEFAULT 'unverified',
	`phoneStatus` enum('unverified','valid','invalid','uncertain') NOT NULL DEFAULT 'unverified',
	`enrichmentStatus` enum('new','partial','complete','error') NOT NULL DEFAULT 'new',
	`outreachStatus` enum('not_started','drafted','reviewed','synced') NOT NULL DEFAULT 'not_started',
	`crmSyncStatus` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastEnrichedAt` timestamp,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_admins` (
	`slot` varchar(24) NOT NULL,
	`openId` varchar(64) NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspace_admins_slot` PRIMARY KEY(`slot`),
	CONSTRAINT `workspace_admins_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `drafts_lead_idx` ON `drafts` (`leadId`);--> statement-breakpoint
CREATE INDEX `leads_name_idx` ON `leads` (`name`);--> statement-breakpoint
CREATE INDEX `leads_source_idx` ON `leads` (`source`);