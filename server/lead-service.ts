import { desc, eq } from "drizzle-orm";
import type { InsertLead, Lead } from "../drizzle/schema";
import { drafts, leads } from "../drizzle/schema";
import { getDb } from "./db";
import type { SearchCandidate } from "./provider-service";

export function normalizeDomain(value?: string | null): string {
  if (!value) return "";
  try { return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return value.trim().toLowerCase().replace(/^www\./, ""); }
}

function normalizeName(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizePhone(value?: string | null): string {
  let digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

function sameLocation(a: Partial<Lead>, b: SearchCandidate): boolean {
  const left = `${a.city ?? ""} ${a.state ?? ""} ${a.address ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const right = `${b.city ?? ""} ${b.state ?? ""} ${b.address ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

function isDuplicate(existing: Lead, incoming: SearchCandidate): boolean {
  if (incoming.sourceId && existing.sourceId && incoming.sourceId === existing.sourceId) return true;
  if (incoming.source === "google_maps") return false;
  const incomingEmail = (incoming.email ?? "").trim().toLowerCase();
  if (incomingEmail && incomingEmail === (existing.email ?? "").trim().toLowerCase()) return true;
  const namesMatch = normalizeName(existing.name) === normalizeName(incoming.name);
  const incomingDomain = normalizeDomain(incoming.website);
  if (namesMatch && incomingDomain && incomingDomain === normalizeDomain(existing.website) && (!incoming.city || !existing.city || sameLocation(existing, incoming))) return true;
  const incomingPhone = normalizePhone(incoming.phone);
  if (incomingPhone && incomingPhone.length >= 7 && incomingPhone === normalizePhone(existing.phone) && sameLocation(existing, incoming)) return true;
  return namesMatch && sameLocation(existing, incoming);
}

export function sanitizeCandidateForStorage(candidate: SearchCandidate): SearchCandidate {
  if (candidate.source === "google_search") {
    throw new Error("Google Search results are temporary. Add only business details you independently confirm on the practice's official website.");
  }
  if (candidate.source === "google_maps") {
    if (!candidate.sourceId) throw new Error("A Google Maps Place ID is required.");
    return {
      source: "google_maps",
      sourceId: candidate.sourceId,
      sourceUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(candidate.sourceId)}`,
      name: "Unverified Google Maps place",
      specialty: candidate.specialty,
      city: candidate.city,
    };
  }
  return candidate;
}

export async function listLeads(): Promise<Lead[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  return db.select().from(leads).orderBy(desc(leads.updatedAt)).limit(500);
}

export async function getLead(id: number): Promise<Lead | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return lead;
}

export async function deleteLead(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  await db.delete(leads).where(eq(leads.id, id));
}

export async function saveCandidates(candidates: SearchCandidate[]): Promise<{ added: number; merged: number; leadIds: number[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const existing = await listLeads();
  let added = 0;
  let merged = 0;
  const leadIds: number[] = [];
  for (const candidate of candidates) {
    const safeCandidate = sanitizeCandidateForStorage(candidate);
    const duplicate = existing.find((lead) => isDuplicate(lead, safeCandidate));
    if (duplicate) {
      const patch: Partial<InsertLead> = {};
      const fields = ["sourceId", "sourceUrl", "name", "specialty", "address", "city", "state", "country", "website", "email", "phone", "rating", "reviewCount"] as const;
      for (const field of fields) {
        const value = safeCandidate[field];
        const canReplaceUnverified = !duplicate.contactSourceVerified && safeCandidate.source !== "google_maps";
        if ((canReplaceUnverified || duplicate[field] === null || duplicate[field] === undefined || duplicate[field] === "") && value !== undefined && value !== "") {
          (patch as Record<string, unknown>)[field] = value;
        }
      }
      if (safeCandidate.source !== "google_maps") {
        patch.source = safeCandidate.source;
        patch.contactSourceVerified = true;
        patch.sourceUrl = safeCandidate.sourceUrl ?? safeCandidate.website ?? duplicate.sourceUrl;
      }
      if (Object.keys(patch).length) {
        await db.update(leads).set({ ...patch, updatedAt: new Date() }).where(eq(leads.id, duplicate.id));
        Object.assign(duplicate, patch);
      }
      merged += 1;
      leadIds.push(duplicate.id);
      continue;
    }
    const isMapsReference = safeCandidate.source === "google_maps";
    const record: InsertLead = {
      source: safeCandidate.source,
      sourceId: safeCandidate.sourceId ?? null,
      sourceUrl: safeCandidate.sourceUrl ?? null,
      name: safeCandidate.name.slice(0, 255),
      specialty: safeCandidate.specialty?.slice(0, 160) ?? null,
      address: isMapsReference ? null : safeCandidate.address ?? null,
      city: safeCandidate.city?.slice(0, 160) ?? null,
      state: isMapsReference ? null : safeCandidate.state?.slice(0, 120) ?? null,
      country: isMapsReference ? null : safeCandidate.country?.slice(0, 100) ?? null,
      website: isMapsReference ? null : safeCandidate.website ?? null,
      email: isMapsReference ? null : safeCandidate.email ?? null,
      phone: isMapsReference ? null : safeCandidate.phone?.slice(0, 80) ?? null,
      rating: null,
      reviewCount: null,
      contactSourceVerified: !isMapsReference,
    };
    const [created] = await db.insert(leads).values(record).$returningId();
    added += 1;
    leadIds.push(created.id);
    existing.unshift({
      id: created.id, source: safeCandidate.source, sourceId: record.sourceId ?? null, sourceUrl: record.sourceUrl ?? null,
      name: record.name, specialty: record.specialty ?? null, address: record.address ?? null,
      city: record.city ?? null, state: record.state ?? null, country: record.country ?? null, website: record.website ?? null,
      email: record.email ?? null, phone: record.phone ?? null, linkedin: null, instagram: null, facebook: null,
      contactSourceVerified: !isMapsReference, rating: null, reviewCount: null,
      emailStatus: "unverified", phoneStatus: "unverified", enrichmentStatus: "new",
      outreachStatus: "not_started", crmSyncStatus: null, createdAt: new Date(), updatedAt: new Date(), lastEnrichedAt: null,
    });
  }
  return { added, merged, leadIds };
}

export async function createVerifiedLead(input: {
  name: string; specialty?: string; address?: string; city?: string; state?: string; country?: string;
  website: string; email?: string; phone?: string; googlePlaceId?: string;
}): Promise<{ id: number; added: number; merged: number }> {
  const result = await saveCandidates([{
    source: "manual", sourceId: input.googlePlaceId, sourceUrl: input.website, name: input.name.trim(),
    specialty: input.specialty, address: input.address, city: input.city, state: input.state, country: input.country,
    website: input.website, email: input.email, phone: input.phone,
  }]);
  return { id: result.leadIds[0], added: result.added, merged: result.merged };
}

export async function updateLead(id: number, patch: Partial<InsertLead>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  await db.update(leads).set({ ...patch, updatedAt: new Date() }).where(eq(leads.id, id));
}

export async function saveDraft(input: { leadId: number; subject: string; body: string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const [draft] = await db.insert(drafts).values(input).$returningId();
  await db.update(leads).set({ outreachStatus: "drafted", updatedAt: new Date() }).where(eq(leads.id, input.leadId));
  return draft.id;
}

export async function listDrafts() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const results = await db.select().from(drafts).orderBy(desc(drafts.updatedAt)).limit(300);
  const allLeads = await listLeads();
  const leadById = new Map(allLeads.map((lead) => [lead.id, lead]));
  return results.map((draft) => ({ ...draft, lead: leadById.get(draft.leadId) ?? null }));
}

export async function updateDraft(id: number, subject: string, body: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  await db.update(drafts).set({ subject, body, status: "edited", updatedAt: new Date() }).where(eq(drafts.id, id));
}
