import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const leadSource = pgEnum("lead_source", ["google_maps", "google_search", "manual"]);
export const emailStatus = pgEnum("email_status", ["unverified", "deliverable", "invalid", "uncertain"]);
export const phoneStatus = pgEnum("phone_status", ["unverified", "valid", "invalid", "uncertain"]);
export const enrichmentStatus = pgEnum("enrichment_status", ["new", "partial", "complete", "error"]);
export const outreachStatus = pgEnum("outreach_status", ["not_started", "drafted", "reviewed", "synced"]);
export const draftStatus = pgEnum("draft_status", ["draft", "edited", "reviewed"]);

// Row Level Security is enabled on every table (no policies). The app server connects
// with the database owner role, which bypasses RLS, while Supabase's public API
// (anon / authenticated keys) can read nothing from these tables.

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash"),
  passwordChangedAt: ts("passwordChangedAt"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: ts("lastSignedIn").defaultNow().notNull(),
}).enableRLS();

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    source: leadSource("source").default("manual").notNull(),
    sourceId: varchar("sourceId", { length: 255 }),
    sourceUrl: text("sourceUrl"),
    name: varchar("name", { length: 255 }).notNull(),
    specialty: varchar("specialty", { length: 160 }),
    address: text("address"),
    city: varchar("city", { length: 160 }),
    state: varchar("state", { length: 120 }),
    country: varchar("country", { length: 100 }),
    website: text("website"),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 80 }),
    linkedin: text("linkedin"),
    instagram: text("instagram"),
    facebook: text("facebook"),
    contactSourceVerified: boolean("contactSourceVerified").default(false).notNull(),
    rating: doublePrecision("rating"),
    reviewCount: integer("reviewCount"),
    emailStatus: emailStatus("emailStatus").default("unverified").notNull(),
    phoneStatus: phoneStatus("phoneStatus").default("unverified").notNull(),
    enrichmentStatus: enrichmentStatus("enrichmentStatus").default("new").notNull(),
    outreachStatus: outreachStatus("outreachStatus").default("not_started").notNull(),
    crmSyncStatus: text("crmSyncStatus"),
    createdAt: ts("createdAt").defaultNow().notNull(),
    updatedAt: ts("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
    lastEnrichedAt: ts("lastEnrichedAt"),
  },
  (table) => [
    index("leads_owner_idx").on(table.ownerId),
    index("leads_name_idx").on(table.name),
    index("leads_source_idx").on(table.source),
  ],
).enableRLS();

export const drafts = pgTable(
  "drafts",
  {
    id: serial("id").primaryKey(),
    leadId: integer("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 500 }).notNull(),
    body: text("body").notNull(),
    status: draftStatus("status").default("draft").notNull(),
    createdAt: ts("createdAt").defaultNow().notNull(),
    updatedAt: ts("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [index("drafts_lead_idx").on(table.leadId)],
).enableRLS();

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    // Only the SHA-256 of the emailed token is stored, so a database leak cannot be used to reset passwords.
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: ts("expiresAt").notNull(),
    usedAt: ts("usedAt"),
    createdAt: ts("createdAt").defaultNow().notNull(),
  },
  (table) => [index("password_reset_user_idx").on(table.userId)],
).enableRLS();

export const integrationSecrets = pgTable("integration_secrets", {
  provider: varchar("provider", { length: 48 }).primaryKey(),
  encryptedValue: text("encryptedValue").notNull(),
  updatedAt: ts("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}).enableRLS();

export const workspaceAdmins = pgTable("workspace_admins", {
  slot: varchar("slot", { length: 24 }).primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  claimedAt: ts("claimedAt").defaultNow().notNull(),
}).enableRLS();

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export type Draft = typeof drafts.$inferSelect;
