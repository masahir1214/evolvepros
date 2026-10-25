import {
  double,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const leads = mysqlTable(
  "leads",
  {
    id: int("id").autoincrement().primaryKey(),
    source: mysqlEnum("source", ["google_maps", "google_search", "manual"]).default("manual").notNull(),
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
    rating: double("rating"),
    reviewCount: int("reviewCount"),
    emailStatus: mysqlEnum("emailStatus", ["unverified", "deliverable", "invalid", "uncertain"]).default("unverified").notNull(),
    phoneStatus: mysqlEnum("phoneStatus", ["unverified", "valid", "invalid", "uncertain"]).default("unverified").notNull(),
    enrichmentStatus: mysqlEnum("enrichmentStatus", ["new", "partial", "complete", "error"]).default("new").notNull(),
    outreachStatus: mysqlEnum("outreachStatus", ["not_started", "drafted", "reviewed", "synced"]).default("not_started").notNull(),
    crmSyncStatus: text("crmSyncStatus"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastEnrichedAt: timestamp("lastEnrichedAt"),
  },
  (table) => ({
    nameIdx: index("leads_name_idx").on(table.name),
    sourceIdx: index("leads_source_idx").on(table.source),
  }),
);

export const drafts = mysqlTable(
  "drafts",
  {
    id: int("id").autoincrement().primaryKey(),
    leadId: int("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 500 }).notNull(),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["draft", "edited", "reviewed"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({ leadIdx: index("drafts_lead_idx").on(table.leadId) }),
);

export const integrationSecrets = mysqlTable("integration_secrets", {
  provider: varchar("provider", { length: 48 }).primaryKey(),
  encryptedValue: text("encryptedValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const workspaceAdmins = mysqlTable("workspace_admins", {
  slot: varchar("slot", { length: 24 }).primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  claimedAt: timestamp("claimedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export type Draft = typeof drafts.$inferSelect;
