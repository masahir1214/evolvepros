CREATE TYPE "public"."draft_status" AS ENUM('draft', 'edited', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('unverified', 'deliverable', 'invalid', 'uncertain');--> statement-breakpoint
CREATE TYPE "public"."enrichment_status" AS ENUM('new', 'partial', 'complete', 'error');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('google_maps', 'google_search', 'manual');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('not_started', 'drafted', 'reviewed', 'synced');--> statement-breakpoint
CREATE TYPE "public"."phone_status" AS ENUM('unverified', 'valid', 'invalid', 'uncertain');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"leadId" integer NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"status" "draft_status" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_secrets" (
	"provider" varchar(48) PRIMARY KEY NOT NULL,
	"encryptedValue" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_secrets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "lead_source" DEFAULT 'manual' NOT NULL,
	"sourceId" varchar(255),
	"sourceUrl" text,
	"name" varchar(255) NOT NULL,
	"specialty" varchar(160),
	"address" text,
	"city" varchar(160),
	"state" varchar(120),
	"country" varchar(100),
	"website" text,
	"email" varchar(320),
	"phone" varchar(80),
	"linkedin" text,
	"instagram" text,
	"facebook" text,
	"contactSourceVerified" boolean DEFAULT false NOT NULL,
	"rating" double precision,
	"reviewCount" integer,
	"emailStatus" "email_status" DEFAULT 'unverified' NOT NULL,
	"phoneStatus" "phone_status" DEFAULT 'unverified' NOT NULL,
	"enrichmentStatus" "enrichment_status" DEFAULT 'new' NOT NULL,
	"outreachStatus" "outreach_status" DEFAULT 'not_started' NOT NULL,
	"crmSyncStatus" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastEnrichedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320) NOT NULL,
	"passwordHash" text,
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_admins" (
	"slot" varchar(24) PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"claimedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_admins_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "workspace_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drafts_lead_idx" ON "drafts" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "leads_name_idx" ON "leads" USING btree ("name");--> statement-breakpoint
CREATE INDEX "leads_source_idx" ON "leads" USING btree ("source");