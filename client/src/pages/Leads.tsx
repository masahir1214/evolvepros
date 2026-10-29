import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowRight, BadgeCheck, Building2, ExternalLink, FileSpreadsheet, Globe2, Mail, MapPin, Phone, Search, ShieldCheck, Sparkles, Trash2, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Lead } from "../../../drizzle/schema";

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
function escapeXml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
const exportColumns: Array<[string, (lead: Lead) => unknown]> = [
  ["Practice", (lead) => lead.name], ["Specialty", (lead) => lead.specialty], ["Address", (lead) => lead.address], ["City", (lead) => lead.city], ["State", (lead) => lead.state], ["Country", (lead) => lead.country], ["Website", (lead) => lead.website], ["Email", (lead) => lead.email], ["Email status", (lead) => lead.emailStatus], ["Phone", (lead) => lead.phone], ["Phone status", (lead) => lead.phoneStatus], ["LinkedIn", (lead) => lead.linkedin], ["Instagram", (lead) => lead.instagram], ["Facebook", (lead) => lead.facebook], ["Source", (lead) => lead.source], ["Verified business details", (lead) => lead.contactSourceVerified ? "Yes" : "No"], ["Google Maps Place ID", (lead) => lead.source === "google_maps" || lead.sourceId ? lead.sourceId : ""], ["Source link", (lead) => lead.sourceUrl], ["Last enriched", (lead) => lead.lastEnrichedAt?.toISOString() ?? ""],
];
function downloadFile(name: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
function exportCsv(leads: Lead[]) {
  const rows = [exportColumns.map(([name]) => escapeCsv(name)).join(","), ...leads.map((lead) => exportColumns.map(([, get]) => escapeCsv(get(lead))).join(","))];
  downloadFile("evolve-practice-leads.csv", `\uFEFF${rows.join("\r\n")}`, "text/csv;charset=utf-8");
}
function exportExcel(leads: Lead[]) {
  const rows = [exportColumns.map(([name]) => name), ...leads.map((lead) => exportColumns.map(([, get]) => get(lead)))];
  const xmlRows = rows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join("")}</Row>`).join("");
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Practice leads"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
  downloadFile("evolve-practice-leads.xls", xml, "application/vnd.ms-excel;charset=utf-8");
}

function StatePill({ value }: { value: "unverified" | "deliverable" | "invalid" | "uncertain" | "valid" }) {
  const good = value === "deliverable" || value === "valid";
  const bad = value === "invalid";
  const label = value === "deliverable" ? "Deliverable" : value === "unverified" ? "Not checked" : value.charAt(0).toUpperCase() + value.slice(1);
  return <span className={`status-pill ${good ? "good" : bad ? "bad" : value === "uncertain" ? "warn" : "neutral"}`}>{label}</span>;
}

function LeadDetail({ lead, onClose, onDeleted }: { lead: Lead; onClose: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(lead.name);
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [website, setWebsite] = useState(lead.website ?? "");
  const [specialty, setSpecialty] = useState(lead.specialty ?? "");
  const [address, setAddress] = useState(lead.address ?? "");
  const [city, setCity] = useState(lead.city ?? "");
  const [state, setState] = useState(lead.state ?? "");
  const [country, setCountry] = useState(lead.country ?? "");
  const [confirmedFromWebsite, setConfirmedFromWebsite] = useState(lead.contactSourceVerified);
  const utils = trpc.useUtils();
  const update = trpc.leads.updateContact.useMutation({ onSuccess: async () => { toast.success("Official-website business details saved."); await utils.leads.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const verifyEmail = trpc.leads.verifyEmail.useMutation({ onSuccess: async (result) => { toast.success(`Email status: ${result.status}. ${result.detail}`); await utils.leads.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const verifyPhone = trpc.leads.verifyPhone.useMutation({ onSuccess: async (result) => { toast.success(`Phone status: ${result.status}. ${result.detail}`); await utils.leads.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const socials = trpc.leads.findSocials.useMutation({ onSuccess: async (result) => { toast.success(Object.values(result).some(Boolean) ? "Public social links found." : "No social profile links were found on that website."); await utils.leads.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const draft = trpc.leads.generateDraft.useMutation({ onSuccess: async () => { toast.success("Editable email draft created."); await utils.leads.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const isAdmin = useAuth().user?.role === "admin";
  const sync = trpc.leads.syncCrm.useMutation({ onSuccess: async (result) => { toast.success(`CRM record synced (${result.externalId}).`); await utils.leads.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const remove = trpc.leads.delete.useMutation({ onSuccess: async () => { toast.success("Lead and linked drafts deleted."); await utils.leads.list.invalidate(); onDeleted(); }, onError: (error) => toast.error(error.message) });
  const syncInfo = (() => { try { return JSON.parse(lead.crmSyncStatus ?? "{}"); } catch { return {}; } })() as Record<string, { status?: string; externalId?: string; syncedAt?: string; error?: string; attemptedAt?: string }>;
  const locked = !lead.contactSourceVerified;
  const sourceLabel = lead.source === "google_maps" ? "Google Maps" : lead.contactSourceVerified ? "Official website" : "Manual";
  const mapsUrl = lead.sourceId ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(lead.sourceId)}` : lead.source === "google_maps" ? lead.sourceUrl : undefined;
  return <aside className="panel detail-card">
    <div className="detail-head">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><span className={lead.source === "google_maps" && !lead.contactSourceVerified ? "maps-attribution" : `source-badge ${lead.contactSourceVerified ? "google" : "maps"}`} translate={lead.source === "google_maps" && !lead.contactSourceVerified ? "no" : undefined}>{sourceLabel}</span><button className="icon-button" aria-label="Close lead details" onClick={onClose}><X size={15} /></button></div>
      <div className="detail-business">{locked && lead.source === "google_maps" ? "Unverified Google Maps place" : lead.name}</div><div className="lead-meta">{lead.specialty || "Healthcare practice"}</div>
      {locked && <div className="notice" style={{ marginTop: 11 }}><strong><ShieldCheck size={13} style={{ verticalAlign: "-2px" }} /> Place ID reference only.</strong> No Maps listing details are stored. Check the practice's official website and enter its business details below to unlock enrichment, AI drafts, export, and CRM sync.</div>}
      {lead.contactSourceVerified && <p className="source-note" style={{ margin: "9px 0 0" }}>Business details confirmed from an official website by the operator.</p>}
      {mapsUrl && <a className="candidate-web" href={mapsUrl} target="_blank" rel="noreferrer"><span className="maps-attribution" translate="no">Google Maps</span> Place ID reference <ExternalLink size={11} /></a>}
      {lead.contactSourceVerified && lead.website && <a className="candidate-web" href={lead.website} target="_blank" rel="noreferrer"><Globe2 size={11} />Official business website <ExternalLink size={11} /></a>}
    </div>
    <form className="detail-section" onSubmit={(event) => { event.preventDefault(); update.mutate({ id: lead.id, name, email, phone, website, specialty, address, city, state, country, confirmedFromBusinessWebsite: true }); }}>
      <div className="detail-label">Official-site business details</div>
      <div className="field" style={{ marginBottom: 9 }}><label htmlFor="lead-name">Practice name</label><input id="lead-name" className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Practice name from official website" /></div>
      <div className="field" style={{ marginBottom: 9 }}><label htmlFor="lead-website">Practice website · HTTPS required</label><input id="lead-website" className="input" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://practice.com" /></div>
      <div className="field" style={{ marginBottom: 9 }}><label htmlFor="lead-email">Business email</label><input id="lead-email" className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="contact@practice.com" /></div>
      {lead.contactSourceVerified && <StatePill value={lead.emailStatus} />}
      <div className="field" style={{ margin: "12px 0 9px" }}><label htmlFor="lead-phone">Business phone</label><input id="lead-phone" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 602 555 0134" /></div>
      {lead.contactSourceVerified && <StatePill value={lead.phoneStatus} />}
      <div className="detail-grid-small">
        <div className="field"><label htmlFor="lead-specialty">Specialty</label><input id="lead-specialty" className="input" value={specialty} onChange={(event) => setSpecialty(event.target.value)} /></div>
        <div className="field"><label htmlFor="lead-city">City</label><input id="lead-city" className="input" value={city} onChange={(event) => setCity(event.target.value)} /></div>
        <div className="field"><label htmlFor="lead-state">State / region</label><input id="lead-state" className="input" value={state} onChange={(event) => setState(event.target.value)} /></div>
        <div className="field"><label htmlFor="lead-country">Country</label><input id="lead-country" className="input" value={country} onChange={(event) => setCountry(event.target.value)} /></div>
      </div>
      <div className="field" style={{ margin: "10px 0 9px" }}><label htmlFor="lead-address">Business address</label><input id="lead-address" className="input" value={address} onChange={(event) => setAddress(event.target.value)} /></div>
      <label className="confirm-row"><input type="checkbox" checked={confirmedFromWebsite} onChange={(event) => setConfirmedFromWebsite(event.target.checked)} /><span>I checked the practice's official website and entered these details independently, not from the Google listing.</span></label>
      <button className="button button-outline button-small" type="submit" disabled={update.isPending || !confirmedFromWebsite || !website || !name.trim()}>{update.isPending ? "Saving…" : "Save confirmed business details"}</button>
      <div className="detail-actions">
        <button className="button button-outline button-small" type="button" onClick={() => verifyEmail.mutate({ id: lead.id })} disabled={locked || !lead.email || verifyEmail.isPending}><BadgeCheck />Check email</button>
        <button className="button button-outline button-small" type="button" onClick={() => verifyPhone.mutate({ id: lead.id })} disabled={locked || !lead.phone || verifyPhone.isPending}><Phone />Check phone</button>
        <button className="button button-outline button-small" type="button" onClick={() => socials.mutate({ id: lead.id })} disabled={locked || !lead.website || socials.isPending}><Globe2 />Find social links</button>
      </div>
      <p className="source-note" style={{ margin: "9px 0 0" }}>Phone lookup reports number validity/line details; it cannot guarantee a person will answer. No contacts are automatically messaged.</p>
    </form>
    <div className="detail-section"><div className="detail-label">Public social profiles</div><div className="social-links">
      {lead.linkedin && <a href={lead.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>}{lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}{lead.facebook && <a href={lead.facebook} target="_blank" rel="noreferrer">Facebook ↗</a>}
      {!lead.linkedin && !lead.instagram && !lead.facebook && <span className="source-note">No profile links found yet.</span>}
    </div></div>
    <div className="detail-section"><div className="detail-label">Outreach and CRM</div><div className="detail-actions" style={{ marginTop: 0 }}>
      <button className="button button-primary button-small" onClick={() => draft.mutate({ id: lead.id })} disabled={locked || draft.isPending}><Sparkles />Create email draft</button>
      {isAdmin && <button className="button button-outline button-small" onClick={() => sync.mutate({ id: lead.id, provider: "hubspot" })} disabled={locked || sync.isPending}><Building2 />{syncInfo.hubspot?.status === "synced" ? "Sync HubSpot again" : "HubSpot"}</button>}
      {isAdmin && <button className="button button-outline button-small" onClick={() => sync.mutate({ id: lead.id, provider: "zoho" })} disabled={locked || sync.isPending}><ArrowDownToLine />{syncInfo.zoho?.status === "synced" ? "Sync Zoho again" : "Zoho CRM"}</button>}
    </div><p className="source-note" style={{ margin: "9px 0 0" }}>{locked ? "Confirm official-website details before using AI or CRM sync." : `${syncInfo.hubspot?.status === "synced" ? `HubSpot synced ${new Date(syncInfo.hubspot.syncedAt ?? "").toLocaleDateString()}. ` : syncInfo.hubspot?.status === "error" ? `HubSpot error: ${syncInfo.hubspot.error}. ` : ""}${syncInfo.zoho?.status === "synced" ? `Zoho synced ${new Date(syncInfo.zoho.syncedAt ?? "").toLocaleDateString()}.` : syncInfo.zoho?.status === "error" ? `Zoho error: ${syncInfo.zoho.error}.` : ""}`}</p></div>
    <div className="detail-section"><button className="button button-danger button-small" type="button" onClick={() => { if (window.confirm(`Delete ${lead.name} and its linked drafts? This cannot be undone.`)) remove.mutate({ id: lead.id }); }} disabled={remove.isPending}><Trash2 />{remove.isPending ? "Deleting…" : "Delete lead and drafts"}</button></div>
  </aside>;
}

export default function Leads() {
  const query = trpc.leads.list.useQuery();
  const leads = query.data ?? [];
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return leads;
    return leads.filter((lead) => [lead.name, lead.specialty, lead.city, lead.state, lead.address, lead.email].some((value) => value?.toLowerCase().includes(term)));
  }, [leads, search]);

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-mark" />Prospect operations</div><h2>Business leads, ready for review.</h2><p>Confirm business details, enrich, verify, draft, and sync healthcare practice prospects from one clean list.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="button button-outline" onClick={() => exportCsv(filtered)} disabled={!filtered.length}><ArrowDownToLine />CSV</button><button className="button button-primary" onClick={() => exportExcel(filtered)} disabled={!filtered.length}><FileSpreadsheet />Excel</button></div></div>
    {query.error && <div className="page-error">Could not load leads: {query.error.message}</div>}
    <div className={selected ? "split-layout" : ""}>
      <section className="panel">
        <div className="table-toolbar"><div className="table-search"><Search size={14} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search practices, specialty, or location" /></div><span className="source-note">{filtered.length} of {leads.length} leads · duplicates merged on save</span></div>
        <div className="table-wrap"><table className="lead-table"><thead><tr><th>Practice</th><th>Location</th><th>Email</th><th>Phone</th><th>Source</th><th>Readiness</th></tr></thead><tbody>
          {filtered.map((lead) => <tr key={lead.id} onClick={() => setSelectedId(lead.id)} style={selectedId === lead.id ? { background: "rgba(124,255,107,.04)" } : undefined}>
            <td><span className="lead-name">{!lead.contactSourceVerified && lead.source === "google_maps" ? "Unverified Google Maps place" : lead.name}</span><span className="lead-meta">{lead.specialty || "Healthcare practice"}</span></td>
            <td><span className={`lead-contact ${!lead.city && !lead.address ? "muted" : ""}`}><MapPin size={11} />{lead.city || lead.address || "—"}</span></td>
            <td><span className={`lead-contact ${!lead.email ? "muted" : ""}`}><Mail size={11} />{lead.email || "Not listed"}</span><span style={{ display: "block", marginTop: 5 }}>{lead.contactSourceVerified && <StatePill value={lead.emailStatus} />}</span></td>
            <td><span className={`lead-contact ${!lead.phone ? "muted" : ""}`}><Phone size={11} />{lead.phone || "Not listed"}</span><span style={{ display: "block", marginTop: 5 }}>{lead.contactSourceVerified && <StatePill value={lead.phoneStatus} />}</span></td>
            <td>{lead.source === "google_maps" ? <span className="maps-attribution" translate="no">Google Maps</span> : <span className="source-badge google">{lead.contactSourceVerified ? "Website verified" : "Manual"}</span>}</td>
            <td><span className={`status-pill ${lead.contactSourceVerified && lead.website ? "good" : "warn"}`}>{lead.contactSourceVerified && lead.website ? "Ready to review" : "Confirm website details"}</span></td>
          </tr>)}
          {query.isLoading && <tr><td colSpan={6}><div className="loading-line">Loading saved practices…</div></td></tr>}
          {!query.isLoading && filtered.length === 0 && <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon"><Users size={18} /></div><strong>{leads.length ? "No matches for that search" : "No saved leads yet"}</strong><p>Search Google Maps for a Place ID reference or independently add details confirmed on an official practice website.</p><button className="button button-primary button-small" onClick={() => { window.location.href = "/search"; }}>Find practices <ArrowRight /></button></div></td></tr>}
        </tbody></table></div>
        <div className="panel-body" style={{ paddingTop: 10 }}><p className="source-note" style={{ margin: 0 }}>Exports include only permitted Maps Place ID references and operator-confirmed business details—not Google Places listing content.</p></div>
      </section>
      {selected && <LeadDetail key={selected.id} lead={selected} onClose={() => setSelectedId(null)} onDeleted={() => setSelectedId(null)} />}
    </div>
  </>;
}
