import { randomUUID, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, PASSWORD_MIN_LENGTH } from "@shared/const";
import type { Lead } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./_core/password";
import { checkRateLimit, clearRateLimit, consumeRateLimit, recordFailure } from "./_core/rateLimit";
import { createSessionToken, isSessionConfigured, SESSION_MAX_AGE_MS } from "./_core/session";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, getUserByEmail, touchLastSignedIn } from "./db";
import { searchPlaces } from "./places";
import { createPasswordResetToken, deliverPasswordReset, resetPasswordWithToken } from "./password-reset";
import { users, workspaceAdmins } from "../drizzle/schema";
import {
  getProviderStatus,
  isEncryptionConfigured,
  providers,
  removeProviderCredentials,
  saveProviderCredentials,
  type Provider,
} from "./credential-store";
import {
  createVerifiedLead,
  deleteLead,
  getLead,
  listDrafts,
  listLeads,
  saveCandidates,
  saveDraft,
  updateDraft,
  updateLead,
} from "./lead-service";
import { generateEmail, googleSearch, syncLead, verifyEmail, verifyPhone } from "./provider-service";
import { findSocialLinks } from "./website-enrichment";

const providerSchema = z.enum(providers);
const credentialFields: Record<Provider, string[]> = {
  googleSearch: ["apiKey"],
  openai: ["apiKey"],
  zeroBounce: ["apiKey"],
  twilio: ["accountSid", "authToken"],
  hubspot: ["accessToken"],
  zoho: ["clientId", "clientSecret", "refreshToken", "apiDomain", "accountsDomain"],
};
const httpsUrl = z.string().trim().min(8).max(2048).url().refine((value) => /^https:\/\//i.test(value), "Use the practice's HTTPS website.");

function safeProviderError(error: unknown): never {
  const message = error instanceof Error ? error.message : "The provider request failed.";
  const missingConfig = /not configured|not available|APP_CREDENTIALS_ENCRYPTION_KEY/i.test(message);
  throw new TRPCError({ code: missingConfig ? "PRECONDITION_FAILED" : "BAD_GATEWAY", message });
}

function requireVerifiedBusinessDetails(lead: Lead): void {
  if (!lead.contactSourceVerified) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "First confirm the practice's business details on its official website. Maps-only search results cannot be sent to verification, enrichment, AI, or CRM providers.",
    });
  }
}

// Everyone shares the administrator's provider keys (Maps, OpenAI, ZeroBounce, Twilio), so
// regular accounts get an hourly allowance of provider-backed actions to cap anyone's spend.
const PROVIDER_CALLS_PER_HOUR = 60;
function enforceProviderQuota(user: { id: number; role: string }) {
  if (user.role === "admin") return;
  const result = consumeRateLimit(`provider:${user.id}`, PROVIDER_CALLS_PER_HOUR, 60 * 60 * 1000);
  if (!result.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `You have reached the hourly limit for searches and verifications. Try again in ${Math.ceil(result.retryAfterSec / 60)} minute(s).` });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user ? { id: opts.ctx.user.id, name: opts.ctx.user.name, email: opts.ctx.user.email, role: opts.ctx.user.role } : null),
    setupStatus: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not available. Check DATABASE_URL." });
      const [owner] = await db.select().from(workspaceAdmins).where(eq(workspaceAdmins.slot, "owner")).limit(1);
      return { setupRequired: !owner, tokenConfigured: Boolean(ENV.adminBootstrapToken), sessionConfigured: isSessionConfigured(), signupOpen: ENV.signupOpen };
    }),
    // One-time creation of the first (and only initial) administrator, protected by APP_ADMIN_BOOTSTRAP_TOKEN.
    setup: publicProcedure.input(z.object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().toLowerCase().email().max(320),
      password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
      token: z.string().min(16).max(512),
    })).mutation(async ({ ctx, input }) => {
      const limitKey = `setup:${ctx.req.ip}`;
      const limit = checkRateLimit(limitKey, 10, 15 * 60 * 1000);
      if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many attempts. Try again in ${limit.retryAfterSec} seconds.` });
      if (!isSessionConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "SESSION_SECRET is not configured on the server." });
      const expected = Buffer.from(ENV.adminBootstrapToken, "utf8");
      const supplied = Buffer.from(input.token, "utf8");
      if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        recordFailure(limitKey);
        throw new TRPCError({ code: "FORBIDDEN", message: "That setup key is not valid." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not available. Check DATABASE_URL." });
      const passwordHash = await hashPassword(input.password);
      const openId = `local_${randomUUID()}`;
      try {
        await db.transaction(async (tx) => {
          const [owner] = await tx.select().from(workspaceAdmins).where(eq(workspaceAdmins.slot, "owner")).limit(1);
          if (owner) throw new TRPCError({ code: "CONFLICT", message: "Workspace ownership has already been claimed. Sign in instead." });
          await tx.insert(users).values({ openId, email: input.email, name: input.name, passwordHash, loginMethod: "email", role: "admin" });
          await tx.insert(workspaceAdmins).values({ slot: "owner", openId });
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "CONFLICT", message: "The owner account could not be created. It may already have been claimed." });
      }
      const token = await createSessionToken(openId);
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: SESSION_MAX_AGE_MS });
      return { success: true as const };
    }),
    login: publicProcedure.input(z.object({
      email: z.string().trim().toLowerCase().email().max(320),
      password: z.string().min(1).max(200),
    })).mutation(async ({ ctx, input }) => {
      const limitKey = `login:${ctx.req.ip}:${input.email}`;
      const limit = checkRateLimit(limitKey, 8, 15 * 60 * 1000);
      if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many failed attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minute(s).` });
      if (!isSessionConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "SESSION_SECRET is not configured on the server." });
      const user = await getUserByEmail(input.email);
      let valid = false;
      if (user) valid = await verifyPassword(input.password, user.passwordHash);
      else await verifyAgainstDummy(input.password);
      if (!user || !valid) {
        recordFailure(limitKey);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password." });
      }
      clearRateLimit(limitKey);
      await touchLastSignedIn(user.id);
      const token = await createSessionToken(user.openId);
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: SESSION_MAX_AGE_MS });
      return { success: true as const };
    }),
    register: publicProcedure.input(z.object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().toLowerCase().email().max(320),
      password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    })).mutation(async ({ ctx, input }) => {
      if (!ENV.signupOpen) throw new TRPCError({ code: "FORBIDDEN", message: "New sign-ups are closed. Ask the administrator for an account." });
      const limit = consumeRateLimit(`register:${ctx.req.ip}`, 5, 60 * 60 * 1000);
      if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many accounts created from this network. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minute(s).` });
      if (!isSessionConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "SESSION_SECRET is not configured on the server." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not available. Check DATABASE_URL." });
      const [owner] = await db.select().from(workspaceAdmins).where(eq(workspaceAdmins.slot, "owner")).limit(1);
      if (!owner) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The workspace is not set up yet. The administrator must create the first account." });
      const taken = new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Sign in or reset your password." });
      if (await getUserByEmail(input.email)) throw taken;
      const passwordHash = await hashPassword(input.password);
      const openId = `local_${randomUUID()}`;
      try {
        await db.insert(users).values({ openId, email: input.email, name: input.name, passwordHash, loginMethod: "email", role: "user" });
      } catch (error) {
        if (await getUserByEmail(input.email)) throw taken;
        throw error;
      }
      const token = await createSessionToken(openId);
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: SESSION_MAX_AGE_MS });
      return { success: true as const };
    }),
    // Always answers the same way, so it cannot be used to discover which emails have accounts.
    requestPasswordReset: publicProcedure.input(z.object({
      email: z.string().trim().toLowerCase().email().max(320),
    })).mutation(async ({ ctx, input }) => {
      const byIp = consumeRateLimit(`reset-ip:${ctx.req.ip}`, 10, 60 * 60 * 1000);
      const byEmail = consumeRateLimit(`reset-email:${input.email}`, 3, 60 * 60 * 1000);
      if (!byIp.allowed || !byEmail.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many reset requests. Try again in a little while." });
      const user = await getUserByEmail(input.email);
      if (user) {
        const token = await createPasswordResetToken(user.id);
        void deliverPasswordReset(user.email, token).catch((error) => console.error("[reset] Could not send the reset email:", error instanceof Error ? error.message : error));
      }
      return { success: true as const };
    }),
    resetPassword: publicProcedure.input(z.object({
      token: z.string().min(20).max(200),
      password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
    })).mutation(async ({ ctx, input }) => {
      const limit = consumeRateLimit(`reset-use:${ctx.req.ip}`, 10, 15 * 60 * 1000);
      if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again in a few minutes." });
      const ok = await resetPasswordWithToken(input.token, input.password);
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link is invalid or has expired. Request a new one." });
      return { success: true as const };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  search: router({
    maps: protectedProcedure.input(z.object({ query: z.string().min(2).max(120), location: z.string().min(2).max(160) })).query(async ({ input, ctx }) => {
      ctx.res.setHeader("Cache-Control", "private, no-store");
      enforceProviderQuota(ctx.user);
      try { return await searchPlaces(input.query, input.location); }
      catch (error) { return safeProviderError(error); }
    }),
    google: protectedProcedure.input(z.object({ query: z.string().min(2).max(120), location: z.string().min(2).max(160) })).query(async ({ input, ctx }) => {
      ctx.res.setHeader("Cache-Control", "private, no-store");
      enforceProviderQuota(ctx.user);
      try { return await googleSearch(input.query, input.location); }
      catch (error) { return safeProviderError(error); }
    }),
  }),

  leads: router({
    list: protectedProcedure.query(async ({ ctx }) => listLeads(ctx.user.id)),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const lead = await getLead(input.id, ctx.user.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      await deleteLead(lead.id, ctx.user.id);
      return { success: true };
    }),
    saveCandidates: protectedProcedure.input(z.object({ candidates: z.array(z.object({
      source: z.enum(["google_maps", "google_search"]),
      sourceId: z.string().max(255).optional(),
      sourceUrl: z.string().max(2048).optional(),
      name: z.string().min(1).max(255),
      specialty: z.string().max(160).optional(),
      address: z.string().max(2000).optional(),
      city: z.string().max(160).optional(),
      country: z.string().max(100).optional(),
      website: z.string().max(2048).optional(),
      phone: z.string().max(80).optional(),
      rating: z.number().optional(),
      reviewCount: z.number().int().nonnegative().optional(),
    })).min(1).max(50) })).mutation(async ({ input, ctx }) => saveCandidates(ctx.user.id, input.candidates)),
    createVerified: protectedProcedure.input(z.object({
      name: z.string().trim().min(1).max(255),
      specialty: z.string().trim().max(160).optional(),
      address: z.string().trim().max(2000).optional(),
      city: z.string().trim().max(160).optional(),
      state: z.string().trim().max(120).optional(),
      country: z.string().trim().max(100).optional(),
      website: httpsUrl,
      email: z.string().trim().email().max(320).or(z.literal("")).optional(),
      phone: z.string().trim().max(80).optional(),
      googlePlaceId: z.string().trim().min(1).max(255).optional(),
      confirmedFromBusinessWebsite: z.literal(true),
    })).mutation(async ({ input, ctx }) => {
      const { confirmedFromBusinessWebsite: _confirmed, ...details } = input;
      return createVerifiedLead(ctx.user.id, details);
    }),
    updateContact: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(255),
      email: z.string().trim().email().max(320).or(z.literal("")),
      phone: z.string().trim().max(80).optional(),
      website: httpsUrl,
      specialty: z.string().trim().max(160).optional(),
      address: z.string().trim().max(2000).optional(),
      city: z.string().trim().max(160).optional(),
      state: z.string().trim().max(120).optional(),
      country: z.string().trim().max(100).optional(),
      confirmedFromBusinessWebsite: z.literal(true),
    })).mutation(async ({ input, ctx }) => {
      const lead = await getLead(input.id, ctx.user.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      const patch = input;
      await updateLead(lead.id, ctx.user.id, {
        name: patch.name,
        source: "manual",
        sourceUrl: patch.website,
        specialty: patch.specialty || null,
        address: patch.address || null,
        city: patch.city || null,
        state: patch.state || null,
        country: patch.country || null,
        email: patch.email || null,
        phone: patch.phone || null,
        website: patch.website,
        contactSourceVerified: true,
        emailStatus: patch.email !== (lead.email ?? "") ? "unverified" : undefined,
        phoneStatus: patch.phone !== (lead.phone ?? "") ? "unverified" : undefined,
      });
      return { success: true };
    }),
    findSocials: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      enforceProviderQuota(ctx.user);
      const lead = await getLead(input.id, ctx.user.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      if (!lead.website) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add a business website before looking for social links." });
      try {
        const socials = await findSocialLinks(lead.website);
        await updateLead(lead.id, ctx.user.id, { ...socials, enrichmentStatus: Object.values(socials).some(Boolean) ? "complete" : "partial", lastEnrichedAt: new Date() });
        return socials;
      } catch (error) { return safeProviderError(error); }
    }),
    verifyEmail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      enforceProviderQuota(ctx.user);
      const lead = await getLead(input.id, ctx.user.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      if (!lead.email) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add a business email before verification." });
      try {
        const result = await verifyEmail(lead.email);
        await updateLead(lead.id, ctx.user.id, { emailStatus: result.status, lastEnrichedAt: new Date() });
        return result;
      } catch (error) { return safeProviderError(error); }
    }),
    verifyPhone: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      enforceProviderQuota(ctx.user);
      const lead = await getLead(input.id, ctx.user.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      if (!lead.phone) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add a business phone before verification." });
      try {
        const result = await verifyPhone(lead.phone);
        await updateLead(lead.id, ctx.user.id, { phoneStatus: result.status, lastEnrichedAt: new Date() });
        return result;
      } catch (error) { return safeProviderError(error); }
    }),
    generateDraft: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      enforceProviderQuota(ctx.user);
      const lead = await getLead(input.id, ctx.user.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      try {
        const generated = await generateEmail(lead);
        const draftId = await saveDraft({ leadId: lead.id, ...generated });
        return { id: draftId, ...generated };
      } catch (error) { return safeProviderError(error); }
    }),
    syncCrm: adminProcedure.input(z.object({ id: z.number().int().positive(), provider: z.enum(["hubspot", "zoho"]) })).mutation(async ({ input, ctx }) => {
      const lead = await getLead(input.id, ctx.user.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      try {
        const result = await syncLead(input.provider, lead);
        let previous: Record<string, unknown> = {};
        try { previous = JSON.parse(lead.crmSyncStatus ?? "{}"); } catch {}
        const next = { ...previous, [input.provider]: { status: "synced", externalId: result.id, syncedAt: new Date().toISOString() } };
        await updateLead(lead.id, ctx.user.id, { crmSyncStatus: JSON.stringify(next), outreachStatus: "synced" });
        return { success: true, externalId: result.id };
      } catch (error) {
        let previous: Record<string, unknown> = {};
        try { previous = JSON.parse(lead.crmSyncStatus ?? "{}"); } catch {}
        const message = error instanceof Error ? error.message.slice(0, 400) : "The provider request failed.";
        const prior = (previous[input.provider] ?? {}) as Record<string, unknown>;
        const next = { ...previous, [input.provider]: { ...prior, status: "error", error: message, attemptedAt: new Date().toISOString() } };
        await updateLead(lead.id, ctx.user.id, { crmSyncStatus: JSON.stringify(next) });
        return safeProviderError(error);
      }
    }),
  }),

  drafts: router({
    list: protectedProcedure.query(async ({ ctx }) => listDrafts(ctx.user.id)),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), subject: z.string().min(1).max(500), body: z.string().min(1).max(12000) })).mutation(async ({ input, ctx }) => {
      const updated = await updateDraft(input.id, ctx.user.id, input.subject, input.body);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found." });
      return { success: true };
    }),
  }),

  settings: router({
    status: protectedProcedure.query(async () => ({ providers: await getProviderStatus(), encryptionReady: isEncryptionConfigured() })),
    saveCredentials: adminProcedure.input(z.object({ provider: providerSchema, credentials: z.record(z.string(), z.string().max(8192)) })).mutation(async ({ input }) => {
      let required = credentialFields[input.provider];
      if (input.provider === "googleSearch") {
        const selected = input.credentials.searchProvider;
        if (selected !== "serpapi" && selected !== "customsearch") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose SerpApi Google Search or an existing Google Custom Search account." });
        }
        required = selected === "customsearch" ? ["apiKey", "engineId"] : ["apiKey"];
      }
      for (const field of required) {
        if (!input.credentials[field]?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: `Enter the required ${field} before saving.` });
      }
      try {
        await saveProviderCredentials(input.provider, input.credentials);
        return { success: true };
      } catch (error) { return safeProviderError(error); }
    }),
    removeCredentials: adminProcedure.input(z.object({ provider: providerSchema })).mutation(async ({ input }) => {
      await removeProviderCredentials(input.provider);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
