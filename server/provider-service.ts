import type { Lead } from "../drizzle/schema";
import { getProviderCredentials, type Provider } from "./credential-store";

const timeout = (ms = 12000) => AbortSignal.timeout(ms);

export type SearchCandidate = {
  source: "google_maps" | "google_search" | "manual";
  sourceId?: string;
  sourceUrl?: string;
  name: string;
  specialty?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  email?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
};

function requireValue(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`${label} is not configured.`);
  return value.trim();
}

export async function googleSearch(query: string, location: string): Promise<SearchCandidate[]> {
  const credentials = await getProviderCredentials("googleSearch");
  const apiKey = requireValue(credentials?.apiKey, "Google Search provider API key");
  const searchProvider = credentials?.searchProvider ?? (credentials?.engineId ? "customsearch" : "serpapi");
  const url = searchProvider === "customsearch"
    ? new URL("https://www.googleapis.com/customsearch/v1")
    : new URL("https://serpapi.com/search");
  const searchQuery = `${query} healthcare practice ${location}`.trim();
  if (searchProvider === "customsearch") {
    const engineId = requireValue(credentials?.engineId, "Google Search Engine ID");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", engineId);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("num", "10");
  } else if (searchProvider === "serpapi") {
    url.searchParams.set("engine", "google");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("location", location);
    url.searchParams.set("num", "10");
  } else {
    throw new Error("Choose either SerpApi Google Search or an existing Google Custom Search account.");
  }
  const response = await fetch(url, { signal: timeout() });
  if (!response.ok) throw new Error(`Google Search returned status ${response.status}.`);
  const data = await response.json() as {
    error?: string;
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
    organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  if (data.error) throw new Error("Google Search provider returned an error. Check its status and saved credentials.");
  const items = searchProvider === "customsearch" ? data.items ?? [] : data.organic_results ?? [];
  return items.filter((item) => item.title && item.link).map((item) => {
    return {
      source: "google_search" as const,
      sourceUrl: item.link,
      name: (item.title ?? "Healthcare practice").replace(/\s+[|–-].*$/, "").trim().slice(0, 255),
      specialty: query.slice(0, 160),
      city: location.slice(0, 160),
      website: item.link,
      country: "United States",
    };
  });
}

export async function verifyEmail(email: string): Promise<{ status: "deliverable" | "invalid" | "uncertain"; detail: string }> {
  const credentials = await getProviderCredentials("zeroBounce");
  const apiKey = requireValue(credentials?.apiKey, "Email verification provider");
  const url = new URL("https://api.zerobounce.net/v2/validate");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("email", email);
  const response = await fetch(url, { signal: timeout() });
  if (!response.ok) throw new Error(`Email verification provider returned status ${response.status}.`);
  const data = await response.json() as { status?: string; sub_status?: string };
  const status = data.status === "valid" ? "deliverable" : data.status === "invalid" ? "invalid" : "uncertain";
  return { status, detail: [data.status, data.sub_status].filter(Boolean).join(" · ") || "Provider returned no status." };
}

export async function verifyPhone(phone: string): Promise<{ status: "valid" | "invalid" | "uncertain"; detail: string }> {
  const credentials = await getProviderCredentials("twilio");
  const accountSid = requireValue(credentials?.accountSid, "Twilio Account SID");
  const authToken = requireValue(credentials?.authToken, "Twilio Auth Token");
  const url = new URL(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}`);
  url.searchParams.set("Fields", "line_type_intelligence");
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, signal: timeout() });
  if (!response.ok) throw new Error(`Phone lookup provider returned status ${response.status}.`);
  const data = await response.json() as { valid?: boolean; phone_number?: string; line_type_intelligence?: { type?: string; carrier_name?: string } };
  const status = data.valid === true ? "valid" : data.valid === false ? "invalid" : "uncertain";
  const detail = [data.phone_number, data.line_type_intelligence?.type, data.line_type_intelligence?.carrier_name].filter(Boolean).join(" · ") || "Provider returned no line details.";
  return { status, detail };
}

export async function generateEmail(lead: Pick<Lead, "name" | "specialty" | "city" | "state" | "website" | "address">): Promise<{ subject: string; body: string }> {
  const credentials = await getProviderCredentials("openai");
  const apiKey = requireValue(credentials?.apiKey, "OpenAI API key");
  const context = [
    `Practice name: ${lead.name}`,
    lead.specialty ? `Specialty: ${lead.specialty}` : "",
    [lead.city, lead.state].filter(Boolean).join(", ") ? `Location: ${[lead.city, lead.state].filter(Boolean).join(", ")}` : "",
    lead.website ? `Website: ${lead.website}` : "",
    lead.address ? `Public business address: ${lead.address}` : "",
  ].filter(Boolean).join("\n");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: timeout(30000),
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.65,
      messages: [
        { role: "system", content: "Write a concise, respectful B2B introduction email for Evolve, a healthcare marketing agency focused on full-funnel patient acquisition for mid-market practices. Personalize only from the supplied public business details. Do not invent results, contact names, needs, or facts. Do not mention patients or imply access to patient data. Keep it under 150 words, with a clear subject and a low-pressure request for a short conversation. Return exactly: Subject: <subject> followed by a blank line and the email body." },
        { role: "user", content: context },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned status ${response.status}.`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty draft.");
  const match = content.match(/^Subject:\s*(.+)\s*\n\s*\n([\s\S]+)$/i);
  return match ? { subject: match[1].trim(), body: match[2].trim() } : { subject: `A quick idea for ${lead.name}`, body: content };
}

function existingCrmRecordId(lead: Lead, provider: "hubspot" | "zoho"): string | undefined {
  try {
    const status = JSON.parse(lead.crmSyncStatus ?? "{}") as Record<string, { externalId?: unknown }>;
    const id = status[provider]?.externalId;
    return typeof id === "string" && id ? id : undefined;
  } catch { return undefined; }
}

function requireZohoUrl(input: string | undefined, kind: "api" | "accounts"): string {
  const raw = requireValue(input, kind === "api" ? "Zoho API domain" : "Zoho Accounts domain");
  const url = new URL(raw);
  const allowed = kind === "api" ? /(^|\.)zohoapis\.(com|eu|in|com\.au|jp|ca|sa)$/i : /(^|\.)accounts\.zoho\.(com|eu|in|com\.au|jp|ca|sa)$/i;
  if (url.protocol !== "https:" || !allowed.test(url.hostname) || url.pathname !== "/") throw new Error(`Zoho ${kind} domain must be an official Zoho HTTPS domain.`);
  return url.origin;
}

async function getZohoAccessToken(credentials: Record<string, string>): Promise<string> {
  const clientId = requireValue(credentials.clientId, "Zoho client ID");
  const clientSecret = requireValue(credentials.clientSecret, "Zoho client secret");
  const refreshToken = requireValue(credentials.refreshToken, "Zoho refresh token");
  const accountsDomain = requireZohoUrl(credentials.accountsDomain, "accounts");
  const url = new URL(`${accountsDomain}/oauth/v2/token`);
  url.searchParams.set("grant_type", "refresh_token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("refresh_token", refreshToken);
  const response = await fetch(url, { method: "POST", signal: timeout() });
  if (!response.ok) throw new Error(`Zoho token refresh returned status ${response.status}.`);
  const data = await response.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error("Zoho could not issue an access token. Check the saved connection details.");
  return data.access_token;
}

export async function syncLead(provider: "hubspot" | "zoho", lead: Lead): Promise<{ id: string; url?: string }> {
  const credentials = await getProviderCredentials(provider);
  if (!credentials) throw new Error(`${provider === "hubspot" ? "HubSpot" : "Zoho CRM"} is not configured.`);
  if (provider === "hubspot") {
    const token = requireValue(credentials.accessToken, "HubSpot private app token");
    const existingId = existingCrmRecordId(lead, "hubspot");
    const endpoint = existingId ? `https://api.hubapi.com/crm/v3/objects/companies/${encodeURIComponent(existingId)}` : "https://api.hubapi.com/crm/v3/objects/companies";
    const response = await fetch(endpoint, {
      method: existingId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: timeout(),
      body: JSON.stringify({ properties: {
        name: lead.name,
        domain: lead.website ? new URL(lead.website).hostname.replace(/^www\./, "") : undefined,
        phone: lead.phone ?? undefined,
        address: lead.address ?? undefined,
        city: lead.city ?? undefined,
        description: `Source: ${lead.source}${lead.specialty ? ` | Specialty: ${lead.specialty}` : ""}`,
      } }),
    });
    if (!response.ok) throw new Error(`HubSpot sync returned status ${response.status}.`);
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("HubSpot did not confirm the company record ID.");
    return { id: result.id };
  }
  const apiDomain = requireZohoUrl(credentials.apiDomain, "api");
  const accessToken = await getZohoAccessToken(credentials);
  const existingId = existingCrmRecordId(lead, "zoho");
  const response = await fetch(`${apiDomain}/crm/v5/Accounts`, {
    method: existingId ? "PUT" : "POST",
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, "Content-Type": "application/json" },
    signal: timeout(),
    body: JSON.stringify({ data: [{ ...(existingId ? { id: existingId } : {}),
      Account_Name: lead.name,
      Website: lead.website ?? undefined,
      Phone: lead.phone ?? undefined,
      Billing_Street: lead.address ?? undefined,
      Billing_City: lead.city ?? undefined,
      Description: `Source: ${lead.source}${lead.specialty ? ` | Specialty: ${lead.specialty}` : ""}`,
    }], trigger: [] }),
  });
  if (!response.ok) throw new Error(`Zoho CRM sync returned status ${response.status}.`);
  const result = await response.json() as { data?: Array<{ details?: { id?: string }; status?: string; message?: string }> };
  const record = result.data?.[0];
  if (record?.status !== "success" || !record.details?.id) throw new Error("Zoho did not confirm this account sync.");
  return { id: record.details.id };
}

export function isProvider(provider: string): provider is Provider {
  return ["googleSearch", "openai", "zeroBounce", "twilio", "hubspot", "zoho"].includes(provider);
}
