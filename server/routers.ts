import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import type { Lead } from "../drizzle/schema";
import { makeRequest } from "./_core/map";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
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

const mapsResultSchema = z.object({
  status: z.string().optional(),
  results: z.array(z.object({
    place_id: z.string().optional(),
    name: z.string().optional(),
    formatted_address: z.string().optional(),
    rating: z.number().optional(),
    user_ratings_total: z.number().optional(),
  })).optional(),
});

const mapDetailsSchema = z.object({
  status: z.string().optional(),
  result: z.object({
    place_id: z.string().optional(),
    name: z.string().optional(),
    formatted_address: z.string().optional(),
    international_phone_number: z.string().optional(),
    formatted_phone_number: z.string().optional(),
    website: z.string().optional(),
    rating: z.number().optional(),
    user_ratings_total: z.number().optional(),
  }).optional(),
});

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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  adminBootstrap: router({
    status: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to continue." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not available." });
      const [owner] = await db.select().from(workspaceAdmins).where(eq(workspaceAdmins.slot, "owner")).limit(1);
      return { claimAvailable: !owner, tokenConfigured: Boolean(process.env.APP_ADMIN_BOOTSTRAP_TOKEN) };
    }),
    claim: publicProcedure.input(z.object({ token: z.string().min(16).max(512) })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to continue." });
      const openId = ctx.user.openId;
      const expected = Buffer.from(process.env.APP_ADMIN_BOOTSTRAP_TOKEN ?? "", "utf8");
      const supplied = Buffer.from(input.token, "utf8");
      if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "That setup key is not valid." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not available." });
      try {
        await db.transaction(async (tx) => {
          const [owner] = await tx.select().from(workspaceAdmins).where(eq(workspaceAdmins.slot, "owner")).limit(1);
          if (owner) throw new TRPCError({ code: "CONFLICT", message: "Workspace ownership has already been claimed." });
          const [admin] = await tx.select().from(users).where(eq(users.role, "admin")).limit(1);
          if (admin) throw new TRPCError({ code: "CONFLICT", message: "An administrator already exists." });
          await tx.insert(workspaceAdmins).values({ slot: "owner", openId });
          await tx.update(users).set({ role: "admin" }).where(eq(users.openId, openId));
        });
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "CONFLICT", message: "The owner claim could not be completed. Another account may have claimed the workspace first." });
      }
    }),
  }),

  search: router({
    maps: adminProcedure.input(z.object({ query: z.string().min(2).max(120), location: z.string().min(2).max(160) })).query(async ({ input, ctx }) => {
      ctx.res.setHeader("Cache-Control", "private, no-store");
      try {
        const searchResult = mapsResultSchema.parse(await makeRequest("/maps/api/place/textsearch/json", {
          query: `${input.query} healthcare practice ${input.location}`,
        }));
        if (searchResult.status === "ZERO_RESULTS") return [];
        if (searchResult.status && searchResult.status !== "OK") throw new Error(`Google Maps returned ${searchResult.status}.`);
        const places = (searchResult.results ?? []).slice(0, 10);
        const results = await Promise.all(places.map(async (place) => {
          if (!place.place_id) return null;
          let detail: z.infer<typeof mapDetailsSchema>["result"];
          try {
            const details = mapDetailsSchema.parse(await makeRequest("/maps/api/place/details/json", {
              place_id: place.place_id,
              fields: "place_id,name,formatted_address,international_phone_number,formatted_phone_number,website,rating,user_ratings_total",
            }));
            detail = details.result;
          } catch {
            detail = undefined;
          }
          const name = detail?.name ?? place.name;
          if (!name) return null;
          return {
            source: "google_maps" as const,
            sourceId: detail?.place_id ?? place.place_id,
            sourceUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.place_id)}`,
            name,
            specialty: input.query,
            address: detail?.formatted_address ?? place.formatted_address,
            city: input.location,
            country: "United States",
            website: detail?.website,
            phone: detail?.international_phone_number ?? detail?.formatted_phone_number,
            rating: detail?.rating ?? place.rating,
            reviewCount: detail?.user_ratings_total ?? place.user_ratings_total,
          };
        }));
        return results.filter(Boolean);
      } catch (error) { return safeProviderError(error); }
    }),
    google: adminProcedure.input(z.object({ query: z.string().min(2).max(120), location: z.string().min(2).max(160) })).query(async ({ input, ctx }) => {
      ctx.res.setHeader("Cache-Control", "private, no-store");
      try { return await googleSearch(input.query, input.location); }
      catch (error) { return safeProviderError(error); }
    }),
  }),

  leads: router({
    list: adminProcedure.query(async () => listLeads()),
    delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const lead = await getLead(input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      await deleteLead(lead.id);
      return { success: true };
    }),
    saveCandidates: adminProcedure.input(z.object({ candidates: z.array(z.object({
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
    })).min(1).max(50) })).mutation(async ({ input }) => saveCandidates(input.candidates)),
    createVerified: adminProcedure.input(z.object({
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
    })).mutation(async ({ input }) => {
      const { confirmedFromBusinessWebsite: _confirmed, ...details } = input;
      return createVerifiedLead(details);
    }),
    updateContact: adminProcedure.input(z.object({
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
    })).mutation(async ({ input }) => {
      const lead = await getLead(input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      const patch = input;
      await updateLead(lead.id, {
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
    findSocials: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const lead = await getLead(input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      if (!lead.website) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add a business website before looking for social links." });
      try {
        const socials = await findSocialLinks(lead.website);
        await updateLead(lead.id, { ...socials, enrichmentStatus: Object.values(socials).some(Boolean) ? "complete" : "partial", lastEnrichedAt: new Date() });
        return socials;
      } catch (error) { return safeProviderError(error); }
    }),
    verifyEmail: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const lead = await getLead(input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      if (!lead.email) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add a business email before verification." });
      try {
        const result = await verifyEmail(lead.email);
        await updateLead(lead.id, { emailStatus: result.status, lastEnrichedAt: new Date() });
        return result;
      } catch (error) { return safeProviderError(error); }
    }),
    verifyPhone: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const lead = await getLead(input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      if (!lead.phone) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add a business phone before verification." });
      try {
        const result = await verifyPhone(lead.phone);
        await updateLead(lead.id, { phoneStatus: result.status, lastEnrichedAt: new Date() });
        return result;
      } catch (error) { return safeProviderError(error); }
    }),
    generateDraft: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const lead = await getLead(input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      try {
        const generated = await generateEmail(lead);
        const draftId = await saveDraft({ leadId: lead.id, ...generated });
        return { id: draftId, ...generated };
      } catch (error) { return safeProviderError(error); }
    }),
    syncCrm: adminProcedure.input(z.object({ id: z.number().int().positive(), provider: z.enum(["hubspot", "zoho"]) })).mutation(async ({ input }) => {
      const lead = await getLead(input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      requireVerifiedBusinessDetails(lead);
      try {
        const result = await syncLead(input.provider, lead);
        let previous: Record<string, unknown> = {};
        try { previous = JSON.parse(lead.crmSyncStatus ?? "{}"); } catch {}
        const next = { ...previous, [input.provider]: { status: "synced", externalId: result.id, syncedAt: new Date().toISOString() } };
        await updateLead(lead.id, { crmSyncStatus: JSON.stringify(next), outreachStatus: "synced" });
        return { success: true, externalId: result.id };
      } catch (error) {
        let previous: Record<string, unknown> = {};
        try { previous = JSON.parse(lead.crmSyncStatus ?? "{}"); } catch {}
        const message = error instanceof Error ? error.message.slice(0, 400) : "The provider request failed.";
        const prior = (previous[input.provider] ?? {}) as Record<string, unknown>;
        const next = { ...previous, [input.provider]: { ...prior, status: "error", error: message, attemptedAt: new Date().toISOString() } };
        await updateLead(lead.id, { crmSyncStatus: JSON.stringify(next) });
        return safeProviderError(error);
      }
    }),
  }),

  drafts: router({
    list: adminProcedure.query(async () => listDrafts()),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), subject: z.string().min(1).max(500), body: z.string().min(1).max(12000) })).mutation(async ({ input }) => {
      await updateDraft(input.id, input.subject, input.body);
      return { success: true };
    }),
  }),

  settings: router({
    status: adminProcedure.query(async () => ({ providers: await getProviderStatus(), encryptionReady: isEncryptionConfigured() })),
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
