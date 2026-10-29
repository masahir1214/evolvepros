CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"usedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ownerId" integer;--> statement-breakpoint
-- Leads created before accounts existed belong to the administrator.
UPDATE "leads" SET "ownerId" = (SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "id" LIMIT 1) WHERE "ownerId" IS NULL;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "ownerId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_owner_idx" ON "leads" USING btree ("ownerId");