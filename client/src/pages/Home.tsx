import { trpc } from "@/lib/trpc";
import { ArrowRight, ArrowUpRight, BadgeCheck, Database, FileText, MapPin, Search, ShieldCheck, Sparkles, Users, WandSparkles } from "lucide-react";
import { useLocation } from "wouter";

function Metric({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: typeof Users }) {
  return <div className="panel metric-card"><div className="metric-label"><Icon className="metric-icon" />{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;
}

export default function Home() {
  const [_, setLocation] = useLocation();
  const leadsQuery = trpc.leads.list.useQuery();
  const draftsQuery = trpc.drafts.list.useQuery();
  const statusQuery = trpc.settings.status.useQuery();
  const leads = leadsQuery.data ?? [];
  const drafts = draftsQuery.data ?? [];
  const verifiedEmails = leads.filter((lead) => lead.emailStatus === "deliverable").length;
  const ready = leads.filter((lead) => lead.emailStatus === "deliverable" && Boolean(lead.website)).length;
  const connected = ["googleSearch", "openai", "zeroBounce", "twilio", "hubspot", "zoho"].filter((provider) => statusQuery.data?.providers[provider as keyof typeof statusQuery.data.providers]).length;
  const recent = [...leads].slice(0, 5);
  const loadError = leadsQuery.error?.message ?? draftsQuery.error?.message ?? statusQuery.error?.message;

  return <>
    <div className="page-heading">
      <div><div className="eyebrow"><span className="eyebrow-mark" />Patient acquisition prospecting</div><h2>Find the practices worth a closer look.</h2><p>Bring public business data, contact checks, and thoughtful outreach drafts into one focused workflow.</p></div>
      <button className="button button-primary" onClick={() => setLocation("/search")}><Search /> Start a search <ArrowUpRight /></button>
    </div>
    {loadError && <div className="page-error">Could not load workspace data: {loadError}. Confirm your admin access and database setup.</div>}
    <section className="metric-grid" aria-label="Workspace metrics">
      <Metric label="Saved practices" value={leadsQuery.isLoading ? "—" : leads.length} note="Business leads in this workspace" icon={Users} />
      <Metric label="Email deliverable" value={leadsQuery.isLoading ? "—" : verifiedEmails} note="Checked with the configured verifier" icon={BadgeCheck} />
      <Metric label="Outreach drafts" value={draftsQuery.isLoading ? "—" : drafts.length} note="Editable · never sent automatically" icon={FileText} />
      <Metric label="Providers configured" value={`${connected}/6`} note="Maps runs through the workspace proxy" icon={ShieldCheck} />
    </section>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-header"><div><div className="panel-title-line"><span className="panel-title-icon"><Database size={15} /></span><h3>Recent practice leads</h3></div><p>Latest business prospects saved to your workspace.</p></div><button className="button button-outline button-small" onClick={() => setLocation("/leads")}>All leads <ArrowRight /></button></div>
        <div className="table-wrap">
          <table className="lead-table" style={{ minWidth: 560 }}>
            <thead><tr><th>Practice</th><th>Location</th><th>Email check</th></tr></thead>
            <tbody>
              {recent.map((lead) => <tr key={lead.id} onClick={() => setLocation("/leads")}>
                <td><span className="lead-name">{lead.name}</span><span className="lead-meta">{lead.specialty || "Healthcare practice"} · {lead.source.replace("google_", "Google ")}</span></td>
                <td><span className="lead-contact"><MapPin size={12} />{lead.city || lead.address || "Location not listed"}</span></td>
                <td><span className={`status-pill ${lead.emailStatus === "deliverable" ? "good" : lead.emailStatus === "invalid" ? "bad" : "neutral"}`}>{lead.emailStatus === "deliverable" ? "Deliverable" : lead.emailStatus === "invalid" ? "Invalid" : lead.emailStatus === "uncertain" ? "Uncertain" : "Not checked"}</span></td>
              </tr>)}
              {!leadsQuery.isLoading && recent.length === 0 && <tr><td colSpan={3}><div className="empty-state"><div className="empty-state-icon"><Search size={18} /></div><strong>Your first practice lead starts here</strong><p>Search by specialty and location. Keep only business prospects that fit Evolve's healthcare acquisition work.</p><button className="button button-primary button-small" onClick={() => setLocation("/search")}>Find practices <ArrowRight /></button></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><div><div className="panel-title-line"><span className="panel-title-icon"><WandSparkles size={15} /></span><h3>Next actions</h3></div><p>Move from discovery to useful context.</p></div></div>
        <div className="panel-body quick-actions">
          <button className="quick-action" onClick={() => setLocation("/search")}><span className="quick-action-icon"><MapPin size={16} /></span><div><strong>Search a new market</strong><span>Find healthcare practices by specialty and city.</span></div><ArrowRight className="arrow" size={15} /></button>
          <button className="quick-action" onClick={() => setLocation("/leads")}><span className="quick-action-icon"><BadgeCheck size={16} /></span><div><strong>Verify a business contact</strong><span>Check email deliverability and phone details.</span></div><ArrowRight className="arrow" size={15} /></button>
          <button className="quick-action" onClick={() => setLocation("/drafts")}><span className="quick-action-icon"><Sparkles size={16} /></span><div><strong>Review an AI email draft</strong><span>Personalize, edit, and approve before outreach.</span></div><ArrowRight className="arrow" size={15} /></button>
          <button className="quick-action" onClick={() => setLocation("/integrations")}><span className="quick-action-icon"><ShieldCheck size={16} /></span><div><strong>Check provider setup</strong><span>{ready} lead{ready === 1 ? "" : "s"} currently ready for a closer look.</span></div><ArrowRight className="arrow" size={15} /></button>
        </div>
      </section>
    </div>
    <p className="source-note" style={{ marginTop: 18 }}>Lead readiness is based only on public business details and configured verification. It is not a patient or clinical data workflow.</p>
  </>;
}
