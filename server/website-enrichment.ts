import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const socialHosts = ["linkedin.com", "instagram.com", "facebook.com"];
const blockedSocialPaths = /\/(login|share|sharer|plugins|intent|about|help)(\/|$)/i;

function isPrivateIp(address: string): boolean {
  if (address.includes(":")) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function assertPublicHttps(input: string): Promise<URL> {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname || url.port && url.port !== "443") throw new Error("Only public HTTPS websites can be enriched.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Private website addresses cannot be enriched.");
  const ipVersion = isIP(hostname);
  if (ipVersion) {
    if (isPrivateIp(hostname)) throw new Error("Private website addresses cannot be enriched.");
  } else {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error("Website resolves to a private network address and was blocked.");
  }
  return url;
}

async function fetchHtml(start: string): Promise<string> {
  let current = start;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const safe = await assertPublicHttps(current);
    const response = await fetch(safe, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9", "User-Agent": "EvolvePracticeProspecting/1.0 (+public-business-profile discovery)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === 3) throw new Error("Website redirected too many times.");
      current = new URL(location, safe).toString();
      continue;
    }
    if (!response.ok) throw new Error(`Website returned status ${response.status}.`);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) throw new Error("Website did not return an HTML page.");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 1_500_000) throw new Error("Website page is too large to enrich safely.");
    const reader = response.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 1_500_000) {
        await reader.cancel();
        throw new Error("Website page is too large to enrich safely.");
      }
      chunks.push(value);
    }
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
    return new TextDecoder().decode(joined);
  }
  throw new Error("Website could not be reached safely.");
}

export async function findSocialLinks(website: string): Promise<{ linkedin: string | null; instagram: string | null; facebook: string | null }> {
  let normalized = website.trim();
  if (/^http:\/\//i.test(normalized)) normalized = normalized.replace(/^http:/i, "https:");
  else if (!/^https:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  const html = await fetchHtml(normalized);
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1].replaceAll("&amp;", "&"));
  const found: { linkedin: string | null; instagram: string | null; facebook: string | null } = { linkedin: null, instagram: null, facebook: null };
  for (const link of links) {
    let url: URL;
    try { url = new URL(link, normalized); } catch { continue; }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!socialHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) continue;
    if (blockedSocialPaths.test(url.pathname)) continue;
    const key = host.includes("linkedin.com") ? "linkedin" : host.includes("instagram.com") ? "instagram" : "facebook";
    if (!found[key]) found[key] = url.toString();
  }
  return found;
}
